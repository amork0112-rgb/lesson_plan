
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';
import { generateLessons, getDaysPerUnit } from '@/lib/lessonEngine';
import { addDays, format, getDay, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Book, BookAllocation, Class, Holiday, Weekday } from '@/types';

// Helper to map 1-6 to calendar months (assuming Start = March)
const MONTH_MAP: Record<number, number> = {
  1: 2, // March (0-indexed)
  2: 3, // April
  3: 4, // May
  4: 5, // June
  5: 6, // July
  6: 7, // August
};

const DAY_MAP: Record<Weekday, number> = {
  'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
};

export async function POST(
  req: NextRequest,
  { params }: { params: { class_id: string } }
) {
  const supabase = getSupabaseService();
  const { class_id } = params;
  
  try {
    const body = await req.json();
    const { month_index, total_sessions, save } = body;

    if (!month_index || !total_sessions) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Fetch Class
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', class_id)
      .single();

    if (classError || !classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const cls = classData as Class;
    const year = cls.year || 2026;
    const month = MONTH_MAP[month_index];
    
    if (month === undefined) {
      return NextResponse.json({ error: 'Invalid month index' }, { status: 400 });
    }

    // 2. Calculate Dates
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

    // 3. Fetch Allocations
    const { data: allocationsData } = await supabase
      .from('book_allocations')
      .select('*, book:books(*)')
      .eq('class_id', class_id)
      .order('priority');

    if (!allocationsData) {
      return NextResponse.json({ error: 'No books assigned' }, { status: 400 });
    }

    // Filter active allocations for this month
    const activeAllocations = allocationsData.filter((a: any) => {
      const sessionsMap = a.sessions_by_month || {};
      const sessionsForMonth = sessionsMap[month_index] || 0;
      return sessionsForMonth > 0;
    });

    if (activeAllocations.length === 0) {
      return NextResponse.json({ error: 'No sessions assigned for this month' }, { status: 400 });
    }

    const books = allocationsData.map((a: any) => a.book);
    const currentBookIds = books.map((b: any) => b.id);

    // 4. Calculate Initial Progress (Continuity)
    const initialProgress: Record<string, { unit: number, day: number }> = {};
    
    // Initialize defaults
    books.forEach((b: any) => {
        initialProgress[b.id] = { unit: 1, day: 1 };
    });

    if (datesToUse.length > 0) {
        // Fetch history
        const { data: previousPlans } = await supabase
        .from('lesson_plans')
        .select('book_id, content')
        .eq('class_id', class_id)
        .in('book_id', currentBookIds)
        .lt('date', datesToUse[0])
        .order('date', { ascending: true });

        if (previousPlans && previousPlans.length > 0) {
            previousPlans.forEach((p: any) => {
                if (!p.book_id || !p.content) return;
                
                // Parse content: "Unit 5 Day 2" or "T9-5 Day 2"
                const unitMatch = p.content.match(/(?:Unit\s+|[A-Za-z0-9]+-)(\d+)\s+Day\s+(\d+)/);
                if (unitMatch) {
                    const u = parseInt(unitMatch[1]);
                    const d = parseInt(unitMatch[2]);
                    
                    // Set current state to what was last used
                    initialProgress[p.book_id] = { unit: u, day: d };
                    
                    // Advance logic
                    const book = books.find((b: any) => b.id === p.book_id);
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

    // 5. Generate Plan
    const monthPlanInput = {
        id: `plan-${year}-${month}`,
        year,
        month,
        allocations: activeAllocations.map((a: any) => ({
            id: a.id,
            class_id: a.class_id,
            book_id: a.book_id,
            priority: a.priority,
            sessions_per_week: 1 
        }))
    };
    
    const planDates = {
        [`plan-${year}-${month}`]: datesToUse
    };
    
    const selectedDays = cls.days;
    
    const generated = generateLessons({
        classId: class_id,
        monthPlans: [monthPlanInput],
        planDates,
        selectedDays,
        books,
        initialProgress 
    });
    
    if (save && generated.length > 0) {
        const startDate = datesToUse[0];
        const endDate = datesToUse[datesToUse.length - 1];
        
        // Delete existing for this period to avoid duplicates
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

    return NextResponse.json({ success: true, count: generated.length });

  } catch (error: any) {
    console.error('Generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
