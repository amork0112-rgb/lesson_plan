
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';
import { generateLessons, getDaysPerUnit } from '@/lib/lessonEngine';
import { addDays, format, getDay, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Book, BookAllocation, Class, Holiday, Weekday } from '@/types';

export const dynamic = 'force-dynamic';

// Helper to map 1-6 to calendar months (assuming Start = March)
const MONTH_MAP: Record<number, number> = {
  1: 2, // March (0-indexed)
  2: 3, // April
  3: 4, // May
  4: 5, // June
  5: 6, // July
  6: 7, // August
};

type AllocationRow = {
  id: string;
  class_id: string;
  book_id: string;
  total_sessions: number | null;
  priority: number;
  sessions_per_week: number;
  book?: any;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseService();
  const { id: class_id } = await params;
  
  try {
    const body = await req.json();
    const { month_index, total_sessions, save } = body;

    if (!month_index || !total_sessions) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // --- STEP 1: ALLOCATION (Distribute Sessions) ---
    
    // Fetch allocations with Book info (needed for both steps)
    const { data: allocData, error: allocErr } = await supabase
      .from('class_book_allocations')
      .select('*, book:books(*)')
      .eq('class_id', class_id)
      .order('priority', { ascending: true });

    if (allocErr) throw new Error(allocErr.message);
    
    const allocations: AllocationRow[] = Array.isArray(allocData) ? (allocData as AllocationRow[]) : [];
    if (allocations.length === 0) {
        return NextResponse.json({ error: 'No books assigned' }, { status: 400 });
    }

    // Fetch existing usage (to calculate remaining)
    const allocIds = allocations.map(a => a.id);
    const { data: sessData, error: sessErr } = await supabase
        .from('course_sessions')
        .select('class_book_allocation_id,month_index,sessions')
        .in('class_book_allocation_id', allocIds);
        
    if (sessErr) throw new Error(sessErr.message);
    
    const usedTotalByAlloc: Record<string, number> = {};
    (Array.isArray(sessData) ? sessData : []).forEach((s: { class_book_allocation_id: string; month_index: number; sessions: number | null }) => {
        // Exclude current month from "used" if we are re-generating it?
        // Actually, "remaining" should be "Total - (Used by OTHER months)".
        // If we include current month in "used", then re-generating might reduce available sessions.
        // Let's exclude current month from calculation to allow re-distribution.
        if (s.month_index !== month_index) {
            usedTotalByAlloc[s.class_book_allocation_id] = (usedTotalByAlloc[s.class_book_allocation_id] || 0) + (s.sessions ?? 0);
        }
    });

    const items = allocations
        .map(a => {
            const total = a.total_sessions ?? 0;
            const used = usedTotalByAlloc[a.id] || 0;
            const remaining = Math.max(0, total - used);
            return { ...a, remaining };
        })
        .filter(a => a.remaining > 0)
        .sort((a, b) => a.priority - b.priority);

    if (items.length === 0) {
        return NextResponse.json({ error: 'No remaining sessions available for any book' }, { status: 400 });
    }

    // Distribute sessions
    const totalWeight = items.reduce((sum, a) => sum + Math.max(1, a.sessions_per_week || 1), 0);
    const initialAlloc = items.map(a => {
        const share = Math.max(1, a.sessions_per_week || 1) / totalWeight;
        const target = Math.floor(total_sessions * share);
        const capped = Math.min(target, a.remaining);
        return { 
            id: a.id, 
            book_id: a.book_id, 
            priority: a.priority, 
            used: capped, 
            remaining_after: a.remaining - capped,
            book: a.book // Pass book info
        };
    });

    let usedSum = initialAlloc.reduce((sum, x) => sum + x.used, 0);
    let leftover = Math.max(0, total_sessions - usedSum);
    
    // Distribute leftover
    while (leftover > 0) {
        let progressed = false;
        for (const a of initialAlloc) {
            if (leftover <= 0) break;
            if (a.remaining_after > 0) {
                a.used += 1;
                a.remaining_after -= 1;
                leftover -= 1;
                usedSum += 1;
                progressed = true;
            }
        }
        if (!progressed) break;
    }

    // Prepare distribution result
    const distributionPlan = initialAlloc.map(p => ({
        class_book_allocation_id: p.id,
        month_index,
        sessions: p.used
    }));

    // Save distribution
    if (save) {
        const { error: saveErr } = await supabase
            .from('course_sessions')
            .upsert(distributionPlan, { onConflict: 'class_book_allocation_id,month_index' });
            
        if (saveErr) throw new Error(`Allocation Save failed: ${saveErr.message}`);
    }

    // --- STEP 2: CONTENT GENERATION (Lesson Plans) ---

    // 1. Fetch Class Info
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', class_id)
      .single();

    if (classError || !classData) throw new Error('Class not found');
    const cls = classData as Class;
    const year = cls.year || 2026;
    const month = MONTH_MAP[month_index];

    // 2. Calculate Dates
    if (month === undefined) throw new Error('Invalid month index');
    const start = new Date(year, month, 1);
    const end = endOfMonth(start);
    const allDays = eachDayOfInterval({ start, end });

    const { data: holidaysData } = await supabase
      .from('holidays')
      .select('*')
      .eq('year', year);
    const holidays = (holidaysData || []) as Holiday[];

    const validDates = allDays.filter(d => {
      const dayName = format(d, 'EEE') as Weekday;
      const isClassDay = cls.days.includes(dayName);
      if (!isClassDay) return false;
      const dStr = format(d, 'yyyy-MM-dd');
      const isHoliday = holidays.some(h => h.date === dStr);
      if (isHoliday) return false;
      return true;
    });

    const datesToUse = validDates.map(d => format(d, 'yyyy-MM-dd')).slice(0, total_sessions);

    // 3. Prepare Input for Generator
    // Use 'initialAlloc' where used > 0
    const activeAllocations = initialAlloc.filter(a => a.used > 0);
    
    // We need 'books' array for generator
    const books = activeAllocations.map(a => a.book);
    
    // 4. Calculate Continuity (Initial Progress)
    const initialProgress: Record<string, { unit: number, day: number }> = {};
    books.forEach((b: any) => {
        initialProgress[b.id] = { unit: 1, day: 1 };
    });

    // Fetch history (all previous plans for this class)
    // We need to fetch plans BEFORE this month to establish continuity.
    // Assuming plans are stored with dates.
    // If we are generating Month 2 (April), we need history up to March 31.
    // But 'datesToUse[0]' is start of this month.
    
    if (datesToUse.length > 0) {
        const firstDate = datesToUse[0];
        
        const { data: previousPlans } = await supabase
            .from('lesson_plans')
            .select('*')
            .eq('class_id', class_id)
            .lt('date', firstDate) // Everything before this month
            .order('date', { ascending: true });

        if (previousPlans) {
            previousPlans.forEach((p: any) => {
                const unitMatch = p.content.match(/(?:Unit\s+|[A-Za-z0-9]+-)(\d+)\s+Day\s+(\d+)/);
                if (unitMatch) {
                    const u = parseInt(unitMatch[1]);
                    const d = parseInt(unitMatch[2]);
                    initialProgress[p.book_id] = { unit: u, day: d };
                    
                    // Advance logic
                    const book = books.find((b: any) => b.id === p.book_id);
                    // Note: 'books' here only contains books for THIS month. 
                    // If a book was used previously but not this month, we don't care about its progress for this generation.
                    // But if it IS used this month, we need its progress.
                    if (book) {
                        const dpu = getDaysPerUnit(book);
                        if (initialProgress[p.book_id].day < dpu) {
                            initialProgress[p.book_id].day++;
                        } else {
                            initialProgress[p.book_id].unit++;
                            initialProgress[p.book_id].day = 1;
                        }
                    }
                }
            });
        }
    }

    // 5. Generate
    const monthPlanInput = {
        id: `plan-${year}-${month}`,
        year: year,
        month: month,
        allocations: activeAllocations.map(a => ({
            id: a.id,
            class_id: class_id,
            book_id: a.book_id,
            priority: a.priority,
            sessions_per_week: 1 
        })),
    };
    
    // We pass the *distribution* to generateLessons via planDates logic
    const planDates = {
        [`plan-${year}-${month}`]: datesToUse
    };
    
    const selectedDays = cls.days;
    
    const generated = generateLessons({
        classId: class_id,
        monthPlans: [monthPlanInput],
        planDates,
        selectedDays,
        books, // Only active books
        initialProgress 
    });
    
    if (save && generated.length > 0) {
        const startDate = datesToUse[0];
        const endDate = datesToUse[datesToUse.length - 1];
        
        // Delete existing lesson plans for this period
        await supabase
          .from('lesson_plans')
          .delete()
          .eq('class_id', class_id)
          .gte('date', startDate)
          .lte('date', endDate);
          
        const { error: insertError } = await supabase
          .from('lesson_plans')
          .insert(generated.map(p => ({
              class_id: p.class_id,
              date: p.date,
              period: p.period,
              book_id: p.book_id,
              book_name: p.book_name,
              content: p.content,
              display_order: p.display_order
          })));
          
        if (insertError) throw insertError;
    }

    return NextResponse.json({ 
        success: true, 
        count: generated.length,
        distribution: distributionPlan 
    });

  } catch (error: any) {
    console.error('Generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
