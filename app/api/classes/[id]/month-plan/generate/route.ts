//app/api/classes/[id]/month-plan/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';
import { generateLessons, getDaysPerUnit } from '@/lib/lessonEngine';
import { getSlotsPerDay } from '@/lib/constants';
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
    const slotsPerDay = getSlotsPerDay(classDays); // Unified slots calculation

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
        .in('type', ['공휴일', '방학']);

    (publicHolidays || []).forEach((ph: any) => {
         holidays.push({
            id: ph.id?.toString() || `ph_${ph.start_date}`,
            date: ph.start_date,
            name: ph.name,
            type: 'national',
            year: parseInt(ph.start_date.split('-')[0]),
            affected_classes: ph.affected_classes // Add affected_classes support
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
        const duration = rawClass.duration || 6;
        indicesToProcess = Array.from({ length: duration }, (_, i) => i + 1);
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
        // slotsPerDay is now calculated outside
        const fixedLessons: any[] = [];
        const initialSlotsUsed: Record<string, number> = {};

        if (inputPlanDates && inputPlanDates[mIdx]) {
            // Use dates provided by frontend (Exact Sync)
            const rawDates = inputPlanDates[mIdx];
            validDates = rawDates.filter((d: string) => {
                const sd = (inputSpecialDates && inputSpecialDates[d]) || specialDates.find(s => s.date === d);
                
                if (sd?.type === 'school_event') {
                    const sessions = sd.sessions || 0;
                    if (sessions >= slotsPerDay) {
                         // Full day event: Inject fixed lessons, skip date for generator
                         for(let i=1; i<=slotsPerDay; i++) {
                             fixedLessons.push({
                                 id: `fixed_${d}_${i}`,
                                 date: d,
                                 period: i,
                                 display_order: 0,
                                 book_id: 'school_event',
                                 book_name: sd.name || 'School Event',
                                content: sd.name || 'Event',
                                is_makeup: false,
                                 unit_no: 0,
                                 day_no: 0,
                                 class_id
                             });
                         }
                         return false; 
                    } else if (sessions > 0) {
                         // Partial day event: Inject fixed lessons, set offset
                         for(let i=1; i<=sessions; i++) {
                             fixedLessons.push({
                                 id: `fixed_${d}_${i}`,
                                 date: d,
                                 period: i,
                                 display_order: 0,
                                 book_id: 'school_event',
                                 book_name: sd.name || 'School Event',
                                content: sd.name || 'Event',
                                is_makeup: false,
                                 unit_no: 0,
                                 day_no: 0,
                                 class_id
                             });
                         }
                         initialSlotsUsed[d] = sessions;
                         return true;
                    }
                }
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
                    
                    // Check if override applies to this class
                    const appliesToClass = !sd.classes || sd.classes.length === 0 || sd.classes.includes(class_id);
                    
                    if (appliesToClass) {
                        if (sd.type === 'no_class') return [];
                        if (sd.type === 'makeup') {
                            const count = sd.sessions || 1;
                            return Array(count).fill(dStr);
                        }
                        if (sd.type === 'school_event') {
                            const sessions = sd.sessions || 0;
                            if (sessions >= slotsPerDay) {
                                for(let i=1; i<=slotsPerDay; i++) {
                                    fixedLessons.push({
                                        id: `fixed_${dStr}_${i}`,
                                        date: dStr,
                                        period: i,
                                        display_order: 0,
                                        book_id: 'school_event',
                                        book_name: sd.name || 'School Event',
                                        content: 'Event',
                                        is_makeup: false,
                                        unit_no: 0,
                                        day_no: 0,
                                        class_id
                                    });
                                }
                                return [];
                            } else if (sessions > 0) {
                                for(let i=1; i<=sessions; i++) {
                                    fixedLessons.push({
                                        id: `fixed_${dStr}_${i}`,
                                        date: dStr,
                                        period: i,
                                        display_order: 0,
                                        book_id: 'school_event',
                                        book_name: sd.name || 'School Event',
                                        content: 'Event',
                                        is_makeup: false,
                                        unit_no: 0,
                                        day_no: 0,
                                        class_id
                                    });
                                }
                                initialSlotsUsed[dStr] = sessions;
                                return [dStr];
                            }
                            return []; 
                        }
                    }
                }

                // 1. Holiday/Vacation -> Exclude
                const isHoliday = holidays.some(h => {
                    if (h.date !== dStr) return false;
                    // Check affected_classes
                    if (h.affected_classes && h.affected_classes.length > 0) {
                        return h.affected_classes.includes(class_id);
                    }
                    return true;
                });
                
                if (isHoliday) return [];

                const sd = specialDates.find(s => s.date === dStr);
                
                // 2. special_date.no_class -> Exclude
                if (sd?.type === 'no_class') return [];
                
                // 3. special_date.makeup -> Include (Force Add)
                if (sd?.type === 'makeup') {
                    const count = sd.sessions || 1;
                    return Array(count).fill(dStr);
                }

                // 4. special_date.school_event
                if (sd?.type === 'school_event') {
                    const sessions = parseInt(String(sd.sessions || 0), 10);
                    if (sessions >= slotsPerDay) {
                         for(let i=1; i<=slotsPerDay; i++) {
                             fixedLessons.push({
                                 id: `fixed_${dStr}_${i}`,
                                 date: dStr,
                                 period: i,
                                 display_order: 0,
                                 book_id: 'school_event',
                                 book_name: sd.name || 'School Event',
                                 content: 'Event',
                                 is_makeup: false,
                                 unit_no: 0,
                                 day_no: 0,
                                 class_id
                             });
                         }
                         return [];
                    } else if (sessions > 0) {
                         for(let i=1; i<=sessions; i++) {
                             fixedLessons.push({
                                 id: `fixed_${dStr}_${i}`,
                                 date: dStr,
                                 period: i,
                                 display_order: 0,
                                 book_id: 'school_event',
                                 book_name: sd.name || 'School Event',
                                 content: 'Event',
                                 is_makeup: false,
                                 unit_no: 0,
                                 day_no: 0,
                                 class_id
                             });
                         }
                         initialSlotsUsed[dStr] = sessions;
                         return [dStr];
                    }
                    return [];
                }
                
                // 5. Standard Schedule
                const dayName = format(d, 'EEE') as Weekday;
                if (classDays.includes(dayName)) {
                    return [dStr];
                }
                return [];
            });
        }

        const capacity = validDates.length; 

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
        let sessionsToFill = capacity * slotsPerDay; 
        
        // Adjust for partial events: Subtract slots already taken by initialSlotsUsed
        // validDates contains the date string. If that date is in initialSlotsUsed, it means some slots are taken.
        // Wait, capacity is based on validDates.length.
        // If a date is in validDates, it means it has at least 1 slot available for LESSONS.
        // But the TOTAL slots for that day is slotsPerDay.
        // We already pushed fixedLessons. 
        // We need to count how many slots are AVAILABLE for lessons.
        // If a date is in validDates, and it has initialSlotsUsed[d] = N, then available slots = slotsPerDay - N.
        
        let availableSlotsForLessons = 0;
        validDates.forEach(d => {
            const used = initialSlotsUsed[d] || 0;
            availableSlotsForLessons += (slotsPerDay - used);
        });
        
        // If we have total_sessions override, we should respect it, but cap at available.
        sessionsToFill = availableSlotsForLessons;

        if (!generate_all && total_sessions) {
            sessionsToFill = Math.min(sessionsToFill, total_sessions);
        }

        // Filter active allocations
        const activeItems = runningAllocations
            .filter(a => {
                const isHomework = a.book?.role === 'homework' || a.book?.name?.startsWith('SCP');
                // Homework books are ALWAYS active for generation if they are assigned
                if (isHomework) return true;
                return a.remaining > 0 || (explicitSessions[a.id] || 0) > 0;
            })
            .sort((a, b) => a.priority - b.priority);

        // Distribute logic
        const monthDistribution = activeItems.map(a => ({ ...a, usedThisMonth: 0 }));
        
        // 🎯 SCP/Homework Logic:
        // SCP books do not count towards the normal sessionsToFill.
        // They are automatically assigned 1 session for each valid date.
        const normalItems = monthDistribution.filter(a => a.book?.role !== 'homework' && !a.book?.name?.startsWith('SCP'));
        const homeworkItems = monthDistribution.filter(a => a.book?.role === 'homework' || a.book?.name?.startsWith('SCP'));

        const hasExplicit = Object.keys(explicitSessions).length > 0;
        
        if (hasExplicit) {
             monthDistribution.forEach(a => {
                const assigned = explicitSessions[a.id] || 0;
                a.usedThisMonth = assigned;
                a.remaining -= assigned; 
            });
        } else if (normalItems.length > 0) {
            const totalWeight = normalItems.reduce((sum, a) => sum + Math.max(1, a.sessions_per_week || 1), 0);
            
            // 1. Proportional Distribution for normal books
            normalItems.forEach(a => {
                const share = Math.max(1, a.sessions_per_week || 1) / totalWeight;
                const target = Math.floor(sessionsToFill * share);
                const actual = Math.min(target, a.remaining);
                a.usedThisMonth = actual;
                a.remaining -= actual; 
            });

            // 2. Distribute Leftover for normal books
            let currentUsed = normalItems.reduce((sum, a) => sum + a.usedThisMonth, 0);
            let leftover = sessionsToFill - currentUsed;

            while (leftover > 0) {
                let progressed = false;
                for (const a of normalItems) {
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

        // 3. Handle Homework/SCP books
        // They get 1 session per valid date (SCP slot), and they don't consume the normal sessionsToFill quota.
        homeworkItems.forEach(a => {
            // For SCP books, we always assign 1 session per class date in the month
            a.usedThisMonth = capacity;
            // We update remaining just for consistency, even if it goes negative for SCP
            a.remaining -= capacity; 
        });

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
        const activeBooks = monthDistribution
            .filter(d => d.usedThisMonth > 0 && d.book)
            .map(d => d.book);
        
        // Fetch history if needed
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
                     // ❌ content parsing -> ✅ column based
                     if (p.book_id && p.unit_no && p.day_no) {
                         const u = p.unit_no;
                         const d = p.day_no;
                         
                         if (currentProgress[p.book_id]) {
                             const book = runningAllocations.find(a => a.book_id === p.book_id)?.book;
                             if (book) {
                                currentProgress[p.book_id] = { unit: u, day: d };
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
            [`plan-${currentYear}-${currentMonth}`]: validDates
        };

        // Generate!
        const generated = generateLessons({
            ownerId: class_id,
            ownerType: 'class',
            monthPlans: [monthPlanInput],
            planDates,
            selectedDays: classDays as Weekday[],
            books: activeBooks,
            initialProgress: JSON.parse(JSON.stringify(currentProgress)),
            initialSlotsUsed: initialSlotsUsed
        });

        // Merge fixed lessons (events) first
        allGeneratedLessons.push(...fixedLessons);
        allGeneratedLessons.push(...generated);

        // Update Progress for next iteration
        generated.forEach(l => {
            // ❌ content parsing -> ✅ column based
            if (l.book_id && l.unit_no && l.day_no) {
                 const u = l.unit_no;
                 const d = l.day_no;
                 
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
                  owner_type: 'class',
                  owner_id: p.owner_id || p.class_id,
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
