//app/api/classes/[id]/month-plan/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';
import { generateLessons, getDaysPerUnit } from '@/lib/lessonEngine';
import { format, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Class, Holiday, Weekday, SpecialDate } from '@/types';

export const dynamic = 'force-dynamic';

function getCalendarInfo(startYear: number, startMonth: number, monthIndex: number) {
  // startMonth is 1-based (e.g., 3 for March)
  // monthIndex is 1-based (1 for first month)
  
  const totalMonths = (startMonth - 1) + (monthIndex - 1);
  const year = startYear + Math.floor(totalMonths / 12);
  const month = totalMonths % 12; // 0-11
  return { year, month };
}

type AllocationRow = {
  id: string;
  class_id: string;
  book_id: string;
  total_sessions: number | null;
  priority: number;
  sessions_per_week: number;
  book?: any;
  used?: number;
  remaining?: number;
  remaining_after?: number;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseService();
  const { id: class_id } = await params;
  
  try {
    const body = await req.json();
    console.log('🔥 generate API HIT', { class_id, body });
    const { 
        month_index, 
        indices, // New: support specific list of indices
        total_sessions, // Used if single month generation
        save, 
        generate_all,
        start_month = 3,
        year: inputYear,
        weekdays, // Allow frontend to override
        special_dates: inputSpecialDates, // Allow frontend to override special dates
        plan_dates: inputPlanDates, // Allow frontend to override plan dates
        initial_progress
    } = body;

    // 1. Fetch Class Info
    // Try to fetch from view first to get aggregated schedules
    let { data: classData, error: classError } = await supabase
      .from('v_classes_with_schedules')
      .select('*')
      .eq('class_id', class_id)
      .single();

    let rawClass: any = classData;

    // If view fails (e.g. row not found because of join type?), fallback to classes table
    if (classError || !classData) {
        const { data: basicClass, error: basicError } = await supabase
          .from('classes')
          .select('*')
          .eq('id', class_id)
          .single();

        if (basicError || !basicClass) {
            return NextResponse.json({ error: 'Class not found' }, { status: 404 });
        }
        rawClass = basicClass;
    }
    
    // Map weekdays (int[]) to days (string[])
    const WEEKDAY_INT_MAP: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
    let classDays: string[] = [];

    // Priority 1: Use weekdays provided in body (UI Override)
    if (weekdays && Array.isArray(weekdays) && weekdays.length > 0) {
        classDays = weekdays;
    } 
    // Priority 2: Attempt to extract from 'weekdays' field (from View)
    else if (rawClass.weekdays && Array.isArray(rawClass.weekdays)) {
        if (rawClass.weekdays.length > 0 && typeof rawClass.weekdays[0] === 'number') {
            classDays = (rawClass.weekdays as number[]).map(w => WEEKDAY_INT_MAP[w]).filter(Boolean);
        } else {
            classDays = rawClass.weekdays; // Assume already strings
        }
    } else if (rawClass.days && Array.isArray(rawClass.days)) {
        // Fallback to 'days' field if present (legacy)
        classDays = rawClass.days;
    }

    // Fallback: If still empty, explicitly query class_schedules
    if (classDays.length === 0) {
        const { data: scheduleData } = await supabase
            .from('class_schedules')
            .select('day')
            .eq('class_id', class_id);
            
        if (scheduleData && scheduleData.length > 0) {
            classDays = scheduleData.map((row: any) => row.day).filter(Boolean);
        }
    }

    // Normalize: Ensure ["Mon", "Tue"] format (Title Case)
    classDays = classDays.map(d => {
        const s = String(d).trim();
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }).filter(d => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(d));

    // VALIDATION (Priority 3)
    if (classDays.length === 0) {
        throw new Error('Class weekdays not configured'); 
    }

    const startYear = inputYear || rawClass.year || 2026;

    // 2. Fetch Global Calendar Data (All Events)
    
    // Fetch Special Dates (Manual)
    const { data: specialDatesData } = await supabase
        .from('special_dates')
        .select('*');

    type DbSpecialDate = SpecialDate & { date: string; id: string };

    const holidays: Holiday[] = [];
    const specialDates: DbSpecialDate[] = [];

    // Fetch Public Holidays from academic_calendar
    const { data: publicHolidays } = await supabase
        .from('academic_calendar')
        .select('*')
        .eq('type', '공휴일');

    (publicHolidays || []).forEach((ph: any) => {
         holidays.push({
            id: ph.id?.toString() || `ph_${ph.start_date}`,
            date: ph.start_date,
            name: ph.name,
            type: 'national',
            year: parseInt(ph.start_date.split('-')[0])
        });
    });

    // Process Special Dates Table
    (specialDatesData || []).forEach((sd: any) => {
        // Filter by class scope:
        // If sd.classes is null or empty, it applies to ALL classes.
        // If sd.classes is NOT empty, it ONLY applies if class_id is in sd.classes.
        const isGlobal = !sd.classes || sd.classes.length === 0;
        const isApplicable = isGlobal || sd.classes.includes(class_id);

        if (!isApplicable) return;

        specialDates.push({
            id: sd.date, // Use date as ID since it's unique
            date: sd.date,
            type: sd.type,
            name: sd.name,
            sessions: sd.sessions
        });

        // Also treat 'no_class' as a holiday to block generation
        if (sd.type === 'no_class') {
             holidays.push({
                id: `sd_${sd.date}`,
                date: sd.date,
                name: sd.name || 'No Class',
                type: 'custom',
                year: parseInt(sd.date.split('-')[0]),
                affected_classes: isGlobal ? [] : [class_id], 
                sessions: sd.sessions
            });
        }
    });

    // 3. Fetch Allocations (with books)
    const { data: allocData, error: allocErr } = await supabase
      .from('class_book_allocations')
      .select('*, book:books(*)')
      .eq('class_id', class_id)
      .neq('book_id', 'e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7')
      .order('priority', { ascending: true });

    if (allocErr) throw new Error(allocErr.message);
    
    const allocations: AllocationRow[] = Array.isArray(allocData) ? (allocData as AllocationRow[]) : [];
    if (allocations.length === 0) {
        return NextResponse.json({ error: 'No books assigned' }, { status: 400 });
    }

    // 4. Determine Scope
    let indicesToProcess: number[] = [];
    if (Array.isArray(indices) && indices.length > 0) {
        indicesToProcess = indices;
    } else if (generate_all) {
        indicesToProcess = [1, 2, 3, 4, 5, 6];
    } else if (month_index) {
        indicesToProcess = [month_index];
    } else {
        indicesToProcess = [1];
    }

    // 5. Initialize State
    // We need to track 'remaining' for each allocation across the loop if generate_all is true.
    // If not generate_all, we need to fetch what was used in other months.
    
    // Calculate initial remaining for all allocations
    // If generate_all, we assume fresh start or we respect existing usage?
    // "Generate All" usually implies a full recalculation.
    // Let's reset 'used' count for the scope we are generating.
    
    const usedTotalByAlloc: Record<string, number> = {};
    
    if (!generate_all) {
        // Fetch usage from OTHER months to subtract
        const allocIds = allocations.map(a => a.id);
        const { data: sessData } = await supabase
            .from('course_sessions')
            .select('class_book_allocation_id,month_index,sessions')
            .in('class_book_allocation_id', allocIds);
            
        (Array.isArray(sessData) ? sessData : []).forEach((s: any) => {
            if (!indicesToProcess.includes(s.month_index)) {
                usedTotalByAlloc[s.class_book_allocation_id] = (usedTotalByAlloc[s.class_book_allocation_id] || 0) + (s.sessions ?? 0);
            }
        });
    }

    // Initialize allocations state
    const runningAllocations = allocations.map(a => ({
        ...a,
        used: 0, // This will track usage WITHIN the current generation scope
        remaining: Math.max(0, (a.total_sessions || 0) - (usedTotalByAlloc[a.id] || 0)),
        book: a.book
    }));

    // Initialize Progress (Unit/Day) for continuity
    // If generate_all, we start from 1-1 (or fetch previous history before startYear/startMonth?)
    // If single month, we fetch history up to that month.
    
    const currentProgress: Record<string, { unit: number, day: number }> = {};
    
    // 1. Initialize from Payload (Frontend Preview State)
    if (initial_progress) {
        Object.entries(initial_progress).forEach(([bid, prog]: [string, any]) => {
            currentProgress[bid] = { unit: prog.unit, day: prog.day };
        });
        console.log('[DEBUG] Using provided initial_progress:', currentProgress);
    } else {
        runningAllocations.forEach(a => {
            if (a.book) currentProgress[a.book.id] = { unit: 1, day: 1 };
        });
    }

    // If not generate_all, we must fetch history to set initial progress correctly
    if (!generate_all) {
         // This part is tricky because 'generateLessons' handles history fetching internally if we pass 'initialProgress'.
         // But here we want to be explicit.
         // Let's rely on the logic inside the loop to fetch history if needed, OR
         // Use the fact that we are generating ONE month, so we just need history up to that month.
         
         // We will handle history fetching inside the loop logic for the first iteration if needed.
    }

    const allGeneratedLessons: any[] = [];
    const allDistributionPlans: any[] = [];

    // --- MAIN LOOP ---
    for (const mIdx of indicesToProcess) {
        if (!mIdx) continue;

        const { year: currentYear, month: currentMonth } = getCalendarInfo(startYear, start_month, mIdx);
        console.log(`[DEBUG] Generating for Month Index ${mIdx} -> ${currentYear}-${currentMonth + 1} (start_month=${start_month})`);
        
        // A. Calculate Capacity (Valid Dates)
        let validDates: string[] = [];

        if (inputPlanDates && inputPlanDates[mIdx]) {
            // Use dates provided by frontend (Exact Sync)
            const rawDates = inputPlanDates[mIdx];
            validDates = rawDates.filter((d: string) => {
                // We still need to filter out 'school_event' so we don't assign books to them
                // 'no_class' should already be filtered by frontend, but safe to check
                const sd = (inputSpecialDates && inputSpecialDates[d]) || specialDates.find(s => s.date === d);
                
                if (sd?.type === 'school_event') return false; 
                return true;
            });
            console.log(`[DEBUG] Using provided plan_dates for Month ${mIdx}: ${validDates.length} valid dates`);
        } else {
             const start = new Date(currentYear, currentMonth, 1);
             const end = endOfMonth(start);
             const allDays = eachDayOfInterval({ start, end });

             validDates = allDays.flatMap(d => {
                const dStr = format(d, 'yyyy-MM-dd');
                
                // 0. Frontend Overrides (Priority)
                if (inputSpecialDates && inputSpecialDates[dStr]) {
                    const sd = inputSpecialDates[dStr];
                    if (sd.type === 'no_class') return [];
                    if (sd.type === 'makeup') {
                        const count = sd.sessions || 1;
                        return Array(count).fill(dStr);
                    }
                    if (sd.type === 'school_event') return []; 
                }

                // 1. Holiday/Vacation -> Exclude
                const isHoliday = holidays.some(h => h.date === dStr);
                if (isHoliday) return [];

                const sd = specialDates.find(s => s.date === dStr);
                
                // 2. special_date.no_class -> Exclude
                if (sd?.type === 'no_class') return [];
                
                // 3. special_date.makeup -> Include (Force Add)
                if (sd?.type === 'makeup') {
                    const count = sd.sessions || 1;
                    return Array(count).fill(dStr);
                }
                
                // 4. Standard Schedule
                const dayName = format(d, 'EEE') as Weekday;
                if (classDays.includes(dayName)) {
                    return [dStr];
                }
                return [];
            });
        }

        const capacity = validDates.length; // This is the total sessions available for this month

        // Fetch explicit session allocations for this month from DB (Source of Truth)
        const { data: dbSessions } = await supabase
            .from('course_sessions')
            .select('class_book_allocation_id, sessions')
            .eq('month_index', mIdx)
            .in('class_book_allocation_id', allocations.map(a => a.id));
            
        const explicitSessions: Record<string, number> = {};
        if (dbSessions) {
            dbSessions.forEach((s: any) => {
                explicitSessions[s.class_book_allocation_id] = s.sessions;
            });
        }

        // B. Distribute Sessions
        // If generate_all, capacity is dynamic. If single month, user might have passed 'total_sessions' override?
        // But for consistency, let's use calculated capacity unless overridden.
        // Actually, the user's "total_sessions" in single generation often matches capacity, but maybe they want less?
        // Let's use calculated capacity as default, or min(capacity, override).
        
        let sessionsToFill = capacity;
        if (!generate_all && total_sessions) {
            sessionsToFill = Math.min(capacity, total_sessions);
        }

        // Filter active allocations (those with remaining > 0 OR explicitly assigned)
        // If explicit sessions exist, we include them even if remaining <= 0 (user override)
        const activeItems = runningAllocations
            .filter(a => a.remaining > 0 || (explicitSessions[a.id] || 0) > 0)
            .sort((a, b) => a.priority - b.priority);

        // Distribute logic
        // Reset 'used' for this month's calculation
        const monthDistribution = activeItems.map(a => ({ ...a, usedThisMonth: 0 }));
        
        // Check if we have explicit sessions
        const hasExplicit = Object.keys(explicitSessions).length > 0;
        
        if (hasExplicit) {
             monthDistribution.forEach(a => {
                const assigned = explicitSessions[a.id] || 0;
                a.usedThisMonth = assigned;
                // Update remaining just for tracking, though it might go negative if over-assigned
                a.remaining -= assigned; 
            });
        } else if (monthDistribution.length > 0) {
            const totalWeight = monthDistribution.reduce((sum, a) => sum + Math.max(1, a.sessions_per_week || 1), 0);
            
            // 1. Proportional Distribution
            monthDistribution.forEach(a => {
                const share = Math.max(1, a.sessions_per_week || 1) / totalWeight;
                const target = Math.floor(sessionsToFill * share);
                const actual = Math.min(target, a.remaining);
                a.usedThisMonth = actual;
                a.remaining -= actual; // Deduct from running total
            });

            // 2. Distribute Leftover
            let currentUsed = monthDistribution.reduce((sum, a) => sum + a.usedThisMonth, 0);
            let leftover = sessionsToFill - currentUsed;

            while (leftover > 0) {
                let progressed = false;
                for (const a of monthDistribution) {
                    if (leftover <= 0) break;
                    if (a.remaining > 0) {
                        a.usedThisMonth += 1;
                        a.remaining -= 1;
                        leftover -= 1;
                        progressed = true;
                    }
                }
                if (!progressed) break;
            }
        }

        // Store distribution for this month
        monthDistribution.forEach(d => {
            if (d.usedThisMonth > 0) {
                allDistributionPlans.push({
                    class_book_allocation_id: d.id,
                    month_index: mIdx,
                    sessions: d.usedThisMonth
                });
            }
        });

        // C. Generate Content
        // We need to know which books are active this month
        // Ensure we only include valid book objects to prevent lookup failures in generateLessons
        const activeBooks = monthDistribution
            .filter(d => d.usedThisMonth > 0 && d.book)
            .map(d => d.book);
        
        // If this is the first iteration and we didn't have previous progress, fetch history
        // Skip DB fetch if initial_progress was provided (Assume frontend has latest state)
        if (!initial_progress && mIdx === indicesToProcess[0] && validDates.length > 0) {
             const firstDate = validDates[0];
             const { data: previousPlans } = await supabase
                .from('lesson_plans')
                .select('*')
                .eq('class_id', class_id)
                .lt('date', firstDate)
                .order('date', { ascending: true });
             
             if (previousPlans) {
                 previousPlans.forEach((p: any) => {
                     const unitMatch = p.content.match(/(?:Unit\s+|[A-Za-z0-9]+-)(\d+)\s+Day\s+(\d+)/);
                     if (unitMatch && p.book_id) {
                         const u = parseInt(unitMatch[1]);
                         const d = parseInt(unitMatch[2]);
                         // Update progress if this is later than what we have
                         // Actually, we just want the state AFTER the last plan.
                         // Simple approach: Apply all history sequentially
                         if (currentProgress[p.book_id]) {
                             // Advance logic
                             const book = runningAllocations.find(a => a.book_id === p.book_id)?.book;
                             if (book) {
                                currentProgress[p.book_id] = { unit: u, day: d };
                                // Move to NEXT slot
                                const dpu = getDaysPerUnit(book);
                                if (currentProgress[p.book_id].day < dpu) {
                                    currentProgress[p.book_id].day++;
                                } else {
                                    currentProgress[p.book_id].unit++;
                                    currentProgress[p.book_id].day = 1;
                                }
                             }
                         }
                     }
                 });
             }
        }

        // Prepare input for generator
        const monthPlanInput = {
            id: `plan-${currentYear}-${currentMonth}`,
            year: currentYear,
            month: currentMonth,
            allocations: monthDistribution.filter(d => d.usedThisMonth > 0).map(d => ({
                book_id: d.book_id,
                sessions: d.usedThisMonth
            }))
        };

        const planDates = {
            [`plan-${currentYear}-${currentMonth}`]: validDates.slice(0, sessionsToFill)
        };

        // Generate!
        const generated = generateLessons({
            classId: class_id,
            monthPlans: [monthPlanInput],
            planDates,
            selectedDays: classDays as Weekday[],
            books: activeBooks,
            initialProgress: JSON.parse(JSON.stringify(currentProgress)) // Deep copy
        });

        allGeneratedLessons.push(...generated);

        // Update Progress for next iteration
        generated.forEach(l => {
            const unitMatch = l.content ? l.content.match(/(?:Unit\s+|[A-Za-z0-9]+-)(\d+)\s+Day\s+(\d+)/) : null;
            if (unitMatch && l.book_id) {
                 const u = parseInt(unitMatch[1]);
                 const d = parseInt(unitMatch[2]);
                 // We need to set the START of the NEXT lesson
                 const book = activeBooks.find(b => b.id === l.book_id);
                 if (book) {
                    currentProgress[l.book_id] = { unit: u, day: d };
                    const dpu = getDaysPerUnit(book);
                    if (currentProgress[l.book_id].day < dpu) {
                        currentProgress[l.book_id].day++;
                    } else {
                        currentProgress[l.book_id].unit++;
                        currentProgress[l.book_id].day = 1;
                    }
                 }
            }
        });
    }

    // 6. Save Results
    if (save) {
        // Save Distributions
        if (allDistributionPlans.length > 0) {
             const { error: saveErr } = await supabase
                .from('course_sessions')
                .upsert(allDistributionPlans, { onConflict: 'class_book_allocation_id,month_index' });
             if (saveErr) throw new Error(`Allocation Save failed: ${saveErr.message}`);
        }

        // Save Lessons
        if (allGeneratedLessons.length > 0) {
            // Determine range to clear
            // If generate_all, we clear everything from start of Month 1 to end of Month 6?
            // Or just the months we processed.
            
            const dates = allGeneratedLessons.map(l => l.date).sort();
            const minDate = dates[0];
            const maxDate = dates[dates.length - 1];

            await supabase
              .from('lesson_plans')
              .delete()
              .eq('class_id', class_id)
              .gte('date', minDate)
              .lte('date', maxDate);

            const { error: insertError } = await supabase
              .from('lesson_plans')
              .insert(allGeneratedLessons.map(p => ({
                  class_id: p.class_id,
                  date: p.date,
                  period: p.period,
                  book_id: p.book_id,
                  content: p.content,
                  display_order: p.display_order,
                  unit_no: p.unit_no,
                  day_no: p.day_no
              })));
            if (insertError) throw insertError;
        }
    }

    return NextResponse.json({
        success: true,
        count: allGeneratedLessons.length,
        distribution: allDistributionPlans,
        generated: allGeneratedLessons
    });

  } catch (error: any) {
    console.error('Generate Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
