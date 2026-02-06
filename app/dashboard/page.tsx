//app/dashboard/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useData } from '@/context/store';
import { calculateBookDistribution } from '@/lib/logic';
import { generateLessons } from '@/lib/lessonEngine';
import { parseLocalDate } from '@/lib/date';
import { startOfWeek } from 'date-fns';
import PdfLayout from '@/components/PdfLayout';
import { BookAllocation, LessonPlan, Weekday, Book, SpecialDate } from '@/types';
import { Play, Download, Trash2, Plus, Calendar as CalendarIcon, Copy, XCircle, ArrowUp, ArrowDown, HelpCircle, GripVertical, Save, Share } from 'lucide-react';

// import html2pdf from 'html2pdf.js'; // Dynamically imported to avoid SSR 'self is not defined' error
import { getSupabase } from '@/lib/supabase';

// Removed exportPdf helper as we use html2pdf now

// --- Types ---
interface MonthPlan {
  id: string;
  year: number;
  month: number; // 0-11
  allocations: BookAllocation[];
}

interface CourseView {
  id: string;
  section: string;
  book: { id: string; name: string; category?: string; level?: string };
  total_sessions: number;
  remaining_sessions: number;
  sessions_by_month: Record<number, number>;
}



const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ALL_WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function getDatesForMonth(
  year: number,
  month: number,
  selectedDays: Weekday[],
  holidays: { date: string; affected_classes?: string[] }[],
  specialDates: Record<string, SpecialDate> = {},
  classId?: string
): string[] {
  const dates: string[] = [];
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // Last day of month
  const allowedDays = new Set(selectedDays);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Use local date string for ALL operations to ensure consistency
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const special = specialDates[dateStr];

    // If it's a no_class (cancellation), skip it regardless of weekday
    if (special?.type === 'no_class') {
      continue;
    }

    // If it's a makeup, include it regardless of weekday
    if (special?.type === 'makeup') {
      dates.push(dateStr);
      continue;
    }

    // Normal logic
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDayName = dayMap[d.getDay()] as Weekday;

    if (allowedDays.has(currentDayName)) {
      const isHoliday = holidays.some(h => {
        if (h.date !== dateStr) return false;
        // If affected_classes is specified, only treat as holiday if this class is affected
        if (h.affected_classes && h.affected_classes.length > 0) {
             if (!classId) return false; 
             return h.affected_classes.includes(classId);
        }
        return true; // Global holiday
      });
      
      if (!isHoliday) {
        dates.push(dateStr);
      }
    }
  }
  
  return dates;
}



 

 

export default function Home() {
  const { books, classes, allocations: globalAllocations, setAllocations, loading, refreshBooks } = useData();
  const [holidays, setHolidays] = useState<{ id: string; date: string; name: string; type: string; affected_classes?: string[] }[]>([]);
  const [specialDates, setSpecialDates] = useState<Record<string, SpecialDate>>({});
  
  // -- Calendar Data Loading --
  useEffect(() => {
    async function loadCalendarData() {
      try {
        // Fallback: Fetch directly from Supabase if API fails
        const supabase = getSupabase();
        if (!supabase) return; // Silent fail or handle error
        
        // 1. Fetch Holidays
        const { data: holidaysData } = await supabase.from('academic_calendar').select('*').eq('type', '공휴일');
        const holidaysList = (holidaysData || []).map(h => ({
            ...h,
            date: h.start_date,
            type: 'public_holiday'
        }));

        // 2. Fetch Special Dates
        const { data: specialData } = await supabase.from('special_dates').select('*');
        
        // Merge logic
        const mergedHolidays = [...holidaysList];
        const mergedSpecial: Record<string, SpecialDate> = {};
        
        (specialData || []).forEach(sd => {
            mergedSpecial[sd.date] = { 
                type: sd.type, 
                name: sd.name,
                sessions: sd.sessions,
                classes: sd.classes
            };

            if (sd.type === 'no_class') {
                mergedHolidays.push({
                   id: `sd_${sd.date}`,
                   date: sd.date,
                   name: sd.name || 'No Class',
                   type: 'custom',
                   affected_classes: sd.classes
                });
            }
        });
        
        setHolidays(mergedHolidays);
        setSpecialDates(mergedSpecial);

      } catch (e) {
        console.error('Error loading calendar data:', e);
      }
    }

    loadCalendarData();
  }, []);
  
  // -- Global Settings --
  const [className, setClassName] = useState('');
  const [classId, setClassId] = useState('');
  const [year, setYear] = useState(2026);
  const [startMonth, setStartMonth] = useState(2); // Default March
  const [duration, setDuration] = useState(6); // Default 6 months
  const [selectedDays, setSelectedDays] = useState<Weekday[]>([]);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState<string>('All');
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Compute unique campuses
  const campuses = useMemo(() => {
    const all = classes.map(c => c.campus).filter(Boolean) as string[];
    // Sort alphabetically
    return ['All', ...Array.from(new Set(all)).sort()];
  }, [classes]);

  // Filter classes based on campus
  const visibleClasses = useMemo(() => {
    if (selectedCampus === 'All') return classes;
    return classes.filter(c => c.campus === selectedCampus);
  }, [classes, selectedCampus]);

  // DEBUG: Check selectedDays
  useEffect(() => {
    console.log('[DEBUG] selectedDays:', selectedDays);
  }, [selectedDays]);

  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:30');
  // -- SCP Settings are per Class (scp_type), no global UI toggle

  // -- Special Dates --
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);

  // -- Monthly Plans --
  const [monthPlans, setMonthPlans] = useState<MonthPlan[]>([]);
  const [assignedCourses, setAssignedCourses] = useState<CourseView[]>([]); // Added state for correct session calculation
  
  // -- Persistence --
  useEffect(() => {
    if (monthPlans.length > 0 && classId) {
        // Guard: Only save if the plan matches the current configuration
        // This prevents saving "old" plans to "new" keys during state transitions
        const firstPlan = monthPlans[0];
        // Calculate expected year/month for the first plan
        
        // If I switched year to 2027, but monthPlans is still 2026...
        if (firstPlan.year !== year && firstPlan.year !== year + 1) return; // Allow next year rollover, but main year should match
        
        // Even stricter:
        // Re-calculate the expected first month's year/month based on current `year` and `startMonth`
        const targetY = year + Math.floor(startMonth / 12);
        const targetM = startMonth % 12;
        
        if (firstPlan.year === targetY && firstPlan.month === targetM && monthPlans.length === duration) {
             localStorage.setItem(`monthPlans_${classId}_${year}_${startMonth}_${duration}`, JSON.stringify(monthPlans));
        }
    }
  }, [monthPlans, classId, year, startMonth, duration]);

  // Load from Persistence
  useEffect(() => {
    if (!classId || !isConfigLoaded) return;
    
    // Guard against empty selectedDays to prevent premature generation
    if (selectedDays.length === 0) return;
    
    const key = `monthPlans_${classId}_${year}_${startMonth}_${duration}`;
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Only log if not already loaded to avoid spam (though effect should run once now)
                console.log('[Debug] Loaded saved plans for', classId);
                setTimeout(() => setMonthPlans(parsed), 0);
                return;
            }
        } catch (e) {
            console.error('Failed to load saved plans', e);
        }
    }
    
    // If no saved data, do not overwrite with empty plans.
    // Let loadClassConfiguration handle the DB fetch and state update.
    // The "Init new" logic here was causing race conditions where empty plans overwrote DB plans.
  }, [classId, year, startMonth, duration, isConfigLoaded]);

  // Sync Allocations to Global Context
  useEffect(() => {
    if (!classId || monthPlans.length === 0) return;

    const currentClassAllocations = monthPlans.flatMap(plan => 
        plan.allocations.map(alloc => ({
            ...alloc,
            month: plan.month,
            year: plan.year,
            class_id: classId
        }))
    );
    
    // Use functional update if possible, or just current globalAllocations
    const otherAllocations = globalAllocations.filter(a => a.class_id !== classId);
    setAllocations([...otherAllocations, ...currentClassAllocations]);
  }, [monthPlans, classId, globalAllocations, setAllocations]);

  // -- Output --
  const [isGenerated, setIsGenerated] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<LessonPlan[]>([]);
  const [pageTitle, setPageTitle] = useState('FRAGE Lesson Plan');


  // -- Computed Usage & Flow --
  // We calculate the flow of sessions: Start -> Used -> Remaining -> Next Start
  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);
  
  // 1. Calculate Continuous Date Stream & Fixed Sessions
  // Rule: Sessions are fixed (8 or 12). Calendar is just a date placement tool.
  // Excess dates flow into the next month's queue.
  const planDates = useMemo(() => {
    const fixedSessions = selectedDays.length === 2 ? 8 : (selectedDays.length === 3 ? 12 : selectedDays.length * 4);
    
    const allValidDates: string[] = [];
    
    if (monthPlans.length === 0) return {};

    const firstPlan = monthPlans[0];
    let currentY = firstPlan.year;
    let currentM = firstPlan.month;
    
    // Generate a pool of dates
    for (let i = 0; i < monthPlans.length + 2; i++) {
        // For the very first month, we want to include days from the previous month 
        // if they fall in the same week (e.g. Mar 31 Mon in Apr view)
        // But only if we are at the start of the sequence.
        
        let dates: string[] = [];
        if (i === 0) {
             // Custom logic for first month to include "Calendar Start"
             const startOfMonth = new Date(currentY, currentM, 1);
             const startOfWeekDate = startOfWeek(startOfMonth, { weekStartsOn: 0 }); // Sunday
             const endOfMonth = new Date(currentY, currentM + 1, 0);
             
             const dateSet = new Set<string>();
             
             for (let d = new Date(startOfWeekDate); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
                 const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                 
                 // Apply filters (weekday, holiday, etc) - Reusing logic from getDatesForMonth would be cleaner but tricky with custom range
                 // Let's replicate the filter logic briefly or extract it
                 
                 // We need to check if it's a valid class day
                 const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                 const currentDayName = dayMap[d.getDay()] as Weekday;
                 
                 const special = specialDates[dateStr];
                 if (special?.type === 'no_class') continue;
                 if (special?.type === 'makeup') {
                     dateSet.add(dateStr);
                     continue;
                 }
                 
                 if (selectedDays.includes(currentDayName)) {
                     const isHoliday = holidays.some(h => {
                        if (h.date !== dateStr) return false;
                        if (h.affected_classes && h.affected_classes.length > 0) {
                             if (!classId) return false; 
                             return h.affected_classes.includes(classId);
                        }
                        return true;
                     });
                     
                     if (!isHoliday) {
                         dateSet.add(dateStr);
                     }
                 }
             }
             dates = Array.from(dateSet).sort((a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime());
             
        } else {
             dates = getDatesForMonth(currentY, currentM, selectedDays, holidays, specialDates, classId);
             dates.sort((a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime());
        }

        allValidDates.push(...dates);
        
        // Next month
        currentM++;
        if (currentM > 11) {
            currentM = 0;
            currentY++;
        }
    }
    
    // 2. Distribute dates into plans
    const distributed: Record<string, string[]> = {};
    let dateCursor = 0;
    
    monthPlans.forEach(plan => {
        const slotsNeeded = fixedSessions;
        // Ensure unique dates in distributed chunks?
        // allValidDates might have duplicates if our logic overlaps? 
        // i=0 logic goes to end of month. i=1 logic starts from next month 1st. No overlap.
        
        const assignedDates = allValidDates.slice(dateCursor, dateCursor + slotsNeeded);
        distributed[plan.id] = assignedDates;
        dateCursor += slotsNeeded;
    });
    
    return distributed;
  }, [monthPlans, selectedDays, holidays, specialDates, classId]);

  // (removed) monthly curriculum grid helpers

  // Combine global books with fallback books from assignedCourses
  const effectiveBooks = useMemo(() => {
      const combined = [...books];
      const existingIds = new Set(books.map(b => b.id));
      
      assignedCourses.forEach(c => {
          if (!existingIds.has(c.book.id)) {
              combined.push({
                  id: c.book.id,
                  name: c.book.name,
                  category: c.book.category || 'General',
                  level: c.book.level,
                  total_units: 0,
                  unit_type: 'unit',
                  days_per_unit: 3, // Default assumption
                  total_sessions: c.total_sessions || 24,
                  // Minimal required fields to satisfy Book type
              } as Book);
              existingIds.add(c.book.id);
          }
      });
      return combined;
  }, [books, assignedCourses]);

  // Filter books based on selected class
  const filteredBooks = useMemo(() => {
    // Rely on classId to find the current class name ensuring sync
    const selectedClass = classes.find(c => c.id === classId);
    
    if (!classId || !selectedClass) {
        // console.log('[Debug] No class selected or found. Returning all books.');
        return effectiveBooks;
    }
    
    // Normalize class name for matching
    // e.g. "R1a/R1b" -> "r1ar1b", "M2" -> "m2"
    const cName = selectedClass.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    // console.log(`[Debug] Filtering books for class: ${selectedClass.name} (normalized: ${cName})`);
    
    const matches = effectiveBooks.filter(b => {
      if (!b.level) return false;
      const bLevel = b.level.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Strict matching: Class name must be contained in Book Level OR Book Level in Class Name
      const isMatch = cName.includes(bLevel) || bLevel.includes(cName);
      
      // Optional: Log matches for debugging
      // if (isMatch) console.log(`[Debug] Match found: ${b.name} (${b.level})`);
      
      return isMatch;
    });
    
    // console.log(`[Debug] Found ${matches.length} matching books.`);
    return matches;
  }, [effectiveBooks, classId, classes]);

  // Removed bookFlow calculation as per user request to simplify dashboard logic


  // -- Handlers --

  const loadClassConfiguration = async (
    cId: string, 
    cYear: number, 
    cStartMonth: number, 
    cDuration: number,
    clearCache: boolean = false
  ) => {
    try {
      console.log(`[Debug] Loading configuration for class ${cId}`);

      // Ensure global book list is up-to-date to prevent missing book warnings
      if (refreshBooks) {
          await refreshBooks();
      }

      if (clearCache) {
        const key = `monthPlans_${cId}_${cYear}_${cStartMonth}_${cDuration}`;
        localStorage.removeItem(key);
        console.log(`[Debug] Cleared cache for key: ${key}`);
      }

      // 1. Load Class Config (Weekdays) - Critical for correct session calculation
      const configRes = await fetch(`/api/classes/${cId}/config`);
      if (configRes.ok) {
        const config = await configRes.json();
        console.log('[Debug] Class config loaded:', config);
        
        // Update class name if provided by API (Source of Truth)
        if (config.name) {
            setClassName(config.name);
        }

        if (config.weekdays && Array.isArray(config.weekdays)) {
           // Ensure valid weekdays (normalize to Title Case: 'Mon', 'Tue'...)
           const normalizeDay = (d: string) => {
               if (!d) return '';
               const s = String(d).trim().toLowerCase();
               if (s.startsWith('mon')) return 'Mon';
               if (s.startsWith('tue')) return 'Tue';
               if (s.startsWith('wed')) return 'Wed';
               if (s.startsWith('thu')) return 'Thu';
               if (s.startsWith('fri')) return 'Fri';
               if (s.startsWith('sat')) return 'Sat';
               if (s.startsWith('sun')) return 'Sun';
               return s.charAt(0).toUpperCase() + s.slice(1);
           };
           
           const validDays = config.weekdays
             .map((d: string) => normalizeDay(d))
             .filter((d: string) => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(d));
             
           console.log('[Debug] Setting selectedDays from API:', validDays);
           
           if (validDays.length > 0) {
               setSelectedDays(validDays as Weekday[]);
           } else {
               console.warn('[Debug] Weekdays array exists but no valid days found after normalization');
               // Do not set empty if we want to preserve previous state? 
               // No, handleClassSelect cleared it. So it remains empty.
           }
           
           // Delay to allow state update to propagate
           setTimeout(() => setIsConfigLoaded(true), 0);
        } else {
            // Even if no weekdays, mark config as loaded so we don't hang?
            console.warn('[Debug] No valid weekdays found in config');
            setIsConfigLoaded(true);
        }
      }
      
      // Config is loaded, safe to proceed with plan generation dependent on weekdays
      // setIsConfigLoaded(true); // Moved inside conditional or timeout above

      const res = await fetch(`/api/classes/${cId}/assigned-courses`);
      if (!res.ok) throw new Error('Failed to fetch assigned courses');
      const courses: CourseView[] = await res.json();
      setAssignedCourses(courses); // Store for rendering logic
      
      const newPlans: MonthPlan[] = [];
      
      Array.from({ length: cDuration }).forEach((_, idx) => {
         const totalMonths = cStartMonth + idx;
         const m = totalMonths % 12;
         const y = cYear + Math.floor(totalMonths / 12);
         
         // Calculate Relative Month Index (1-based index relative to the plan start)
         // User requested: "monthIndex = (currentMonth - startMonth) + 1" which simplifies to idx + 1
         // This ensures that the first month of the plan always maps to 'Month 1' in the assigned course sessions.
         const academicMonthIndex = idx + 1;
         
         const allocations: BookAllocation[] = [];
         
         courses.forEach((course, courseIdx) => {
             // 🎯 Filter: Only include books with active sessions in this specific month
             // academicMonthIndex (1..12) corresponds to sessions_by_month keys
             const sessionsThisMonth = course.sessions_by_month?.[academicMonthIndex] ?? 0;
             
             // Strict Rule: If sessions are 0, do not show the book at all for this month
             if (sessionsThisMonth <= 0) {
                 return;
             }

             // Validate that the book exists in the global book list OR in the assigned courses
             // Global books is preferred, but assigned courses is a valid fallback source
             const bookExists = books.find(b => b.id === course.book.id) || 
                                courses.find(c => c.book.id === course.book.id);
                                
             if (!bookExists) {
                 console.warn(`[Critical Warning] Book not found in global books AND assigned courses: ${course.book.name} (ID: ${course.book.id}). This may cause display issues.`);
             }

             // Simply assign the book without quantity constraints
             // "sessions_by_month ... 전부 제거"
             
             // 🔥 Critical: Apply override ONLY for the first month to ensure correct start value
             // Subsequent months will carry over automatically via bookFlow logic
             const isFirstMonth = idx === 0;

             // Calculate override for first month
             let initialTotal = 24; // Default
             
             // 1. Try global book
             const globalBook = books.find(b => b.id === course.book.id);
             if (globalBook?.total_sessions) {
                 initialTotal = globalBook.total_sessions;
             } else {
                 // 2. Try assigned course data
                 if (course.total_sessions) {
                     initialTotal = course.total_sessions;
                 }
             }

             allocations.push({
                 id: Math.random().toString(),
                 class_id: cId,
                 book_id: course.book.id,
                 sessions_per_week: 2, // Legacy field, effectively ignored
                 priority: courseIdx + 1,
                 monthly_sessions: sessionsThisMonth,
                 total_sessions_override: isFirstMonth 
                    ? initialTotal
                    : undefined
             });
         });
         
         newPlans.push({
           id: `m_${y}_${m}`,
           year: y,
           month: m,
           allocations
         });
      });
      
      console.log('[Debug] Generated plans from DB:', newPlans);
      setMonthPlans(newPlans);
      // Show calendar for the first month by default
      if (newPlans.length > 0) {
        setExpandedMonthId(newPlans[0].id);
      }
      
    } catch (e) {
      console.error('Error loading class configuration:', e);
    }
  };

  const handleClassSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    const selectedClass = classes.find(c => c.id === cid);
    if (selectedClass) {
      console.log('[Debug] Selected class:', selectedClass);
      setClassId(cid);
      setClassName(selectedClass.name);
      // Ensure year is a number
      const cYear = typeof selectedClass.year === 'number' ? selectedClass.year : parseInt(selectedClass.year as any) || 2026;
      setYear(cYear);
      
      setStartTime(selectedClass.start_time);
      setEndTime(selectedClass.end_time);
      
      // Reset plans and load from DB
      setMonthPlans([]);
      setIsGenerated(false);
      setGeneratedPlan([]);
      
      // Reset config state to prevent premature plan generation
      setIsConfigLoaded(false);
      setSelectedDays([]); 
      
      // Load assigned courses immediately
      loadClassConfiguration(cid, cYear, startMonth, duration);
      
    } else {
        setClassName('');
    }
  };

  const handleDayToggle = (day: Weekday) => {
    // Reset plans when schedule structure changes
    setMonthPlans([]);
    setIsGenerated(false);
    setGeneratedPlan([]);
    
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const toggleDateStatus = async (dateStr: string) => {
     const current = specialDates[dateStr];
     let nextData: SpecialDate | null = null;
     
     if (!current) {
        nextData = { type: 'no_class', name: 'No Class' }; 
     } else if (current.type === 'no_class') {
        nextData = { type: 'makeup', name: 'Makeup' };
     } else if (current.type === 'makeup') {
       nextData = { type: 'school_event', name: 'PBL', sessions: 1 };
    } else if (current.type === 'school_event') {
        const eventOrder = ['PBL', '정기평가', 'PBL (Tech)', '100Days', 'Vocaton', 'PBL (Econ)'];
        const currentIndex = eventOrder.indexOf(current.name);
        
        if (currentIndex !== -1 && currentIndex < eventOrder.length - 1) {
            nextData = { type: 'school_event', name: eventOrder[currentIndex + 1] };
        } else {
            nextData = null; 
        }
     } else {
        nextData = null;
     }
     
    if (nextData) {
      setSpecialDates(prev => ({ ...prev, [dateStr]: nextData! }));
    } else {
      setSpecialDates(prev => {
        const rest = { ...prev };
        delete rest[dateStr];
        return rest;
      });
    }

    try {
        if (nextData) {
            await fetch('/api/calendar/special-dates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: dateStr,
                    type: nextData.type,
                    name: nextData.name
                })
            });
        } else {
            await fetch(`/api/calendar/special-dates/${dateStr}`, {
                method: 'DELETE'
            });
        }
    } catch (error) {
        console.error('Failed to save special date:', error);
    }
  };

  const getPlansForMonth = (monthId: string): LessonPlan[] => {
    // Use the generated plan from state (Server Side Source of Truth)
    const targetPlan = monthPlans.find(p => p.id === monthId);
    if (!targetPlan) return [];
    
    // Instead of strict date checking, check if the date belongs to this plan's allocation
    // This allows dates from prev/next month (rollovers) to appear in this month's view
    const allocatedDates = planDates[monthId] || [];

    return generatedPlan.filter(l => {
      if (l.book_id === 'no_class') return false;
      return allocatedDates.includes(l.date);
    });
  };

  // Removed specialDates reset effect to avoid setState in effect

  const saveMonthlyPlan = async (monthId: string, silent: boolean = false) => {
    const monthly = getPlansForMonth(monthId);
    const target = monthPlans.find(p => p.id === monthId);
    if (!target) return false;

    try {
      const res = await fetch('/api/lesson-plans/save-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          year: target.year,
          month: target.month,
          lessons: monthly
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save plan');
      }

      if (!silent) alert('해당 월 플랜을 Supabase에 저장했습니다.');
      return true;
    } catch (e: any) {
      console.error('Save failed:', e);
      if (!silent) alert(`저장 실패: ${e.message}`);
      return false;
    }
  };

  const handleSaveAll = async () => {
      if (!confirm('현재 보이는 모든 변경사항을 데이터베이스에 저장하시겠습니까?')) return;
      
      let successCount = 0;
      let failCount = 0;
      
      // Show loading indicator? For now, just blocking alerts if we didn't silence them, but we will silence them.
      for (const plan of monthPlans) {
          const success = await saveMonthlyPlan(plan.id, true);
          if (success) successCount++;
          else failCount++;
      }
      
      if (failCount === 0) {
          alert('모든 월의 플랜이 성공적으로 저장되었습니다.');
      } else {
          alert(`${successCount}개 월 저장 성공, ${failCount}개 월 저장 실패.`);
      }
  };
  
  const moveAllocation = (monthId: string, allocId: string, direction: 'up' | 'down') => {
    setMonthPlans(monthPlans.map(plan => {
      if (plan.id !== monthId) return plan;
      
      const index = plan.allocations.findIndex(a => a.id === allocId);
      if (index === -1) return plan;
      
      const newAllocations = [...plan.allocations];
      
      if (direction === 'up') {
        if (index === 0) return plan; // Already at top
        // Swap
        [newAllocations[index - 1], newAllocations[index]] = [newAllocations[index], newAllocations[index - 1]];
      } else {
        if (index === newAllocations.length - 1) return plan; // Already at bottom
        // Swap
        [newAllocations[index], newAllocations[index + 1]] = [newAllocations[index + 1], newAllocations[index]];
      }
      
      // Re-assign priorities based on new order
      const reorderedAllocations = newAllocations.map((a, idx) => ({
        ...a,
        priority: idx + 1
      }));
      
      return {
        ...plan,
        allocations: reorderedAllocations
      };
    }));
  };

  // Removed auto-download effect to avoid setState in effect

  /* 
  // REMOVED: html2pdf implementation causing lab() color errors
  const generatePlanPDF = async (): Promise<Blob> => {
    // ...
  };
  */

  const handleDownloadPDF = () => {
    if (!isGenerated) {
        alert('먼저 Preview Plan을 실행해주세요.');
        return;
    }

    // PDF 안전모드 강제
    document.body.classList.add('pdf-safe');

    // 프린트
    window.print();

    // 복구
    setTimeout(() => {
        document.body.classList.remove('pdf-safe');
    }, 1000);
  };

  const handleSharePDF = async () => {
    if (!generatedPlan || generatedPlan.length === 0) {
        alert('먼저 Preview Plan을 실행해주세요.');
        return;
    }

    const mPlan = monthPlans.find(p => p.id === expandedMonthId) ?? monthPlans[0];
    const m = mPlan ? mPlan.month : 0;
    const y = mPlan ? mPlan.year : year;

    if (!confirm(`${y}년 ${className}반 수업계획안 PDF를 생성하고 학부모에게 공유하시겠습니까?`)) return;

    setIsSharing(true);
    try {
        const res = await fetch('/api/pdf/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                classId,
                year: y,
                month: m
            })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Failed to share PDF');
        }

        alert('PDF가 성공적으로 생성 및 공유되었습니다!\n공지사항에서 확인 가능합니다.');
    } catch (e: any) {
        console.error(e);
        alert('공유 실패: ' + e.message);
    } finally {
        setIsSharing(false);
    }
  };

  const handleGenerate = async (targetMonthId?: string) => {
    // 1. Validation Checks
    if (selectedDays.length === 0) {
        alert('수업 요일(Schedule Days)이 선택되지 않았습니다. 상단의 요일을 최소 하나 이상 선택해주세요.');
        return;
    }

    const totalAllocations = monthPlans.reduce((sum, p) => sum + p.allocations.length, 0);
    if (totalAllocations === 0) {
        alert('배정된 교재가 없습니다. Class Management 페이지에서 교재를 먼저 배정해주세요.');
        return;
    }

    // Check if we have valid dates
    const totalPotentialDates = Object.values(planDates).reduce((sum, dates) => sum + dates.length, 0);
    console.log('[Debug] Total Potential Dates:', totalPotentialDates, 'Selected Days:', selectedDays);
    
    if (totalPotentialDates === 0) {
        alert(`선택한 요일(${selectedDays.join(', ')})에 해당하는 날짜가 ${year}년에 없습니다. 연도나 요일 설정을 확인해주세요.`);
        return;
    }

    try {
        // Prepare Plan Dates Map (Index -> Dates)
        const planDatesMap: Record<number, string[]> = {};
        monthPlans.forEach((plan, idx) => {
            const pDates = planDates[plan.id] || [];
            planDatesMap[idx + 1] = pDates;
        });

        // NEW: Calculate Initial Progress from Previous Month (if exists)
        let initialProgress: Record<string, { unit: number, day: number }> | undefined;
        
        if (targetMonthId) {
             const targetIdx = monthPlans.findIndex(p => p.id === targetMonthId);
             if (targetIdx > 0) {
                 const prevPlan = monthPlans[targetIdx - 1];
                 const prevDates = planDates[prevPlan.id] || [];
                 // Find last lessons for each book in the previous plan's dates
                 const prevLessons = generatedPlan.filter(l => prevDates.includes(l.date));
                 
                 if (prevLessons.length > 0) {
                     initialProgress = {};
                     // Sort to get the last one
                     const sorted = [...prevLessons].sort((a, b) => {
                         if (a.date !== b.date) return a.date.localeCompare(b.date);
                         return (a.period || 0) - (b.period || 0);
                     });
                     
                     sorted.forEach(l => {
                         if (!l.book_id || l.book_id === 'no_class' || l.book_id === 'school_event') return;
                         // Use type assertion for unit_no/day_no as they might not be in LessonPlan type yet
                         const u = (l as any).unit_no;
                         const d = (l as any).day_no;
                         if (u && d) {
                             initialProgress![l.book_id] = { unit: u, day: d };
                         }
                     });
                     console.log('[Debug] Calculated Initial Progress:', initialProgress);
                 }
             }
        }

        // Prepare API Payload
        const payload: any = {
            year,
            start_month: startMonth + 1, // Backend expects 1-based month (e.g. 3 for March)
            save: false, // Preview only
            indices: [],
            weekdays: selectedDays, // Pass current UI selection
            special_dates: specialDates, // Pass current UI special dates
            plan_dates: planDatesMap, // Pass calculated dates for sync
            initial_progress: initialProgress // Pass progress state
        };

        if (targetMonthId) {
            const idx = monthPlans.findIndex(p => p.id === targetMonthId);
            if (idx !== -1) {
                payload.indices = [idx + 1];
            }
        } else {
            payload.generate_all = true;
        }

        const res = await fetch(`/api/classes/${classId}/month-plan/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Generation failed');
        }

        const data = await res.json();
        const allLessons = data.generated as LessonPlan[];

        // Inject 'no_class' items for display in PDF
        const noClassLessons: LessonPlan[] = [];
        monthPlans.forEach(plan => {
            const start = new Date(plan.year, plan.month, 1);
            const end = new Date(plan.year, plan.month + 1, 0);
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                
                // Check if it is a scheduled weekday
                const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const dayName = dayMap[d.getDay()] as Weekday;
                if (!selectedDays.includes(dayName)) continue;
                
                // Check if it is no_class (Special Date OR Global Holiday)
                const special = specialDates[dateStr];
                
                // Check for Global Holiday
                const holiday = holidays.find(h => {
                    if (h.date !== dateStr) return false;
                    if (h.affected_classes && h.affected_classes.length > 0) {
                         if (!classId) return false; 
                         return h.affected_classes.includes(classId);
                    }
                    return true;
                });

                if (special?.type === 'no_class') {
                    noClassLessons.push({
                        id: `nc_${dateStr}`,
                        class_id: classId,
                        date: dateStr,
                        display_order: 0,
                        is_makeup: false,
                        book_id: 'no_class',
                        book_name: 'No Class',
                        content: special.name || 'No Class',
                        period: 0
                    } as LessonPlan);
                } else if (special?.type === 'school_event') {
                    // Do nothing - handled by API
                } else if (holiday) {
                     // Add Holiday as a "No Class" block
                     noClassLessons.push({
                        id: `hol_${dateStr}`,
                        class_id: classId,
                        date: dateStr,
                        display_order: 0,
                        is_makeup: false,
                        book_id: 'no_class', // Treat as no_class for styling (red)
                        book_name: 'Holiday',
                        content: holiday.name || 'Holiday',
                        period: 0
                    } as LessonPlan);
                }
            }
        });

        let allPlans: LessonPlan[] = [...allLessons, ...noClassLessons].sort((a, b) => {
            const da = parseLocalDate(a.date);
            const db = parseLocalDate(b.date);
            if (da.getTime() !== db.getTime()) return da.getTime() - db.getTime();
            return (a.period || 0) - (b.period || 0);
        });

        let alertMessage: string | null = null;

        if (targetMonthId) {
            const targetPlan = monthPlans.find(p => p.id === targetMonthId);
            const targetPlanIndex = monthPlans.findIndex(p => p.id === targetMonthId);

            if (targetPlan) {
                // Filter plans for this month
                const monthlyPlans = allPlans.filter(l => {
                    const [y, m] = l.date.split('-').map(Number);
                    return (m - 1) === targetPlan.month && y === targetPlan.year;
                });
                
                if (monthlyPlans.length > 0) {
                    allPlans = monthlyPlans;
                    const monthName = MONTH_NAMES[targetPlan.month];
                    const fileName = `LessonPlan_${className}_${monthName}_${targetPlan.year}`;
                    setPageTitle(fileName);
                } else {            
                    const academicMonthIndex = targetPlanIndex + 1;
                    const hasAssignedSessions = assignedCourses.some(c => (c.sessions_by_month?.[academicMonthIndex] || 0) > 0);

                    if (!hasAssignedSessions) {
                        alertMessage = `No sessions scheduled for ${MONTH_NAMES[targetPlan.month]}. This class has books, but no sessions assigned to this month (Month ${academicMonthIndex}).`;
                    } else {
                        alertMessage = `Warning: Sessions are assigned for ${MONTH_NAMES[targetPlan.month]}, but no lessons could be generated. Please check holidays or schedule days.`;
                    }
                    allPlans = []; 
                }
            }
        } else {
            setPageTitle(`LessonPlan_${className}_All_Months_${year}`);
            if (allPlans.length === 0) {
                alertMessage = '수업이 생성되지 않았습니다. 다음을 확인해주세요:\n1. 교재의 "Weekly Sessions"가 0이 아닌지\n2. 선택한 요일이 달력에 존재하는지';
            }
        }

        if (targetMonthId) {
            setGeneratedPlan(prev => {
                 const targetDates = planDates[targetMonthId] || [];
                 // Remove existing lessons for these dates to avoid duplicates
                 const others = prev.filter(l => !targetDates.includes(l.date));
                 const merged = [...others, ...allPlans];
                 return merged.sort((a, b) => {
                    const da = parseLocalDate(a.date);
                    const db = parseLocalDate(b.date);
                    if (da.getTime() !== db.getTime()) return da.getTime() - db.getTime();
                    return (a.period || 0) - (b.period || 0);
                 });
            });
        } else {
            setGeneratedPlan(allPlans);
        }
        setIsGenerated(true);
        requestAnimationFrame(() => {
            const el = document.getElementById('preview-root');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        if (alertMessage) {
            alert(alertMessage);
        }

    } catch (e: any) {
        console.error('Generation Error:', e);
        alert(`Failed to generate plans: ${e.message}`);
    }
  };
  
  // -- Drag & Drop Handlers --
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetDate: string, targetLessonId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain');
    
    setGeneratedPlan(prev => {
        const cloned = [...prev];
        const draggedLesson = cloned.find(l => l.id === draggedId);
        if (!draggedLesson) return prev;
        
        const sourceDate = draggedLesson.date;
        
        // 1. Remove dragged lesson from the pool
        const remaining = cloned.filter(l => l.id !== draggedId);
        
        // 2. Prepare Target List (items currently in target date)
        // Clone items to avoid mutating state directly
        const targetLessons = remaining
            .filter(l => l.date === targetDate)
            .map(l => ({ ...l }));
            
        targetLessons.sort((a, b) => (a.period || 0) - (b.period || 0));
        
        // 3. Insert Dragged Lesson
        const newLessonState = { ...draggedLesson, date: targetDate };
        
        if (targetLessonId) {
            const targetIndex = targetLessons.findIndex(l => l.id === targetLessonId);
            if (targetIndex !== -1) {
                targetLessons.splice(targetIndex, 0, newLessonState);
            } else {
                targetLessons.push(newLessonState);
            }
        } else {
            // Dropped on container -> Append
            targetLessons.push(newLessonState);
        }
        
        // 4. Recalculate Periods for Target Date
        targetLessons.forEach((l, idx) => {
            l.period = idx + 1;
        });
        
        // 5. Recalculate Periods for Source Date (if different)
        let sourceUpdates: any[] = [];
        if (sourceDate !== targetDate) {
            const sourceLessons = remaining
                .filter(l => l.date === sourceDate)
                .map(l => ({ ...l })); // Clone
                
            sourceLessons.sort((a, b) => (a.period || 0) - (b.period || 0));
            sourceLessons.forEach((l, idx) => {
                l.period = idx + 1;
            });
            sourceUpdates = sourceLessons;
        }
        
        // 6. Reconstruct State
        const finalMap = new Map();
        
        // Add all from remaining (these are untouched refs from prev state)
        remaining.forEach(l => {
            // Skip target date items (we have new versions)
            // Skip source date items (we have new versions)
            if (l.date !== targetDate && l.date !== sourceDate) {
                finalMap.set(l.id, l);
            }
        });
        
        // Add updated source items
        if (sourceDate !== targetDate) {
            sourceUpdates.forEach(l => finalMap.set(l.id, l));
        } else {
            // If source == target, they are already in targetLessons, so we don't need to add them from 'remaining' 
            // (actually we skipped them in the loop above? No, we skipped targetDate. If source==target, we skipped them.)
        }
        
        // Add updated target items
        targetLessons.forEach(l => finalMap.set(l.id, l));
        
        // If source != target, we handled source via sourceUpdates.
        // If source == target, targetLessons covers everything.
        // But wait, in the 'remaining' loop:
        // if (l.date !== targetDate && l.date !== sourceDate)
        // If source == target, this is effectively (l.date !== targetDate).
        // So we skip them. And then we add 'targetLessons'. Correct.
        // If source != target, we skip both. We add 'sourceUpdates' and 'targetLessons'. Correct.
        
        return Array.from(finalMap.values());
    });
  };



  // 미리보기 초기화는 연도/시작월 변경 이벤트 핸들러에서 수행
  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header / No Print */}
      <div className="no-print">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Plan Generator</h1>
          <p className="text-gray-500">Configure monthly curriculum and track remaining sessions.</p>
          
          {/* Usage Guide */}
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-600 bg-blue-50 p-4 rounded-lg border border-blue-100 items-center">
            <span className="font-semibold text-blue-800 mr-2">Usage Steps:</span>
            <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-blue-200 shadow-sm">
                <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-xs font-bold">1</span>
                <span>Preview Plan</span>
            </span>
            <span className="text-gray-400">→</span>
            <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-blue-200 shadow-sm">
                <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-xs font-bold">2</span>
                <span>Adjust (Drag & Drop)</span>
            </span>
            <span className="text-gray-400">→</span>
            <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-blue-200 shadow-sm">
                <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-xs font-bold">3</span>
                <span>Save All Changes & Share</span>
            </span>
            <span className="text-gray-400">→</span>
            <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-blue-200 shadow-sm">
                <span className="w-5 h-5 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-xs font-bold">4</span>
                <span>Download PDF</span>
            </span>

          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          {/* Top Settings Bar */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-start">
              <div className="flex gap-4 items-start">
                  <div className="w-32">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Campus</label>
                    <select
                        value={selectedCampus}
                        onChange={(e) => {
                            setSelectedCampus(e.target.value);
                            setClassName(''); 
                            setClassId('');
                        }}
                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border bg-white"
                    >
                        {campuses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="w-36">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Class Name</label>
                    <select 
                      value={classId} 
                      onChange={handleClassSelect}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border bg-white"
                    >
                      <option value="">Select Class</option>
                      {visibleClasses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
              </div>

              {/* Schedule Days Removed as per request */}

              <div className="w-24">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Year</label>
                <div className="relative">
                  <select 
                    value={year} 
                    onChange={(e) => {
                      const y = parseInt(e.target.value);
                      setYear(y);
                      setIsGenerated(false);
                      setGeneratedPlan([]);
                      if (classId) {
                          setMonthPlans([]);
                          setIsConfigLoaded(false);
                          loadClassConfiguration(classId, y, startMonth, duration, true);
                      }
                    }}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border bg-gray-50 appearance-none"
                  >
                    {Array.from({ length: 5 }).map((_, i) => {
                      const y = 2026 + i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="w-28">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Start Month</label>
                <select 
                  value={startMonth} 
                  onChange={(e) => {
                    const m = parseInt(e.target.value);
                    setStartMonth(m);
                    setIsGenerated(false);
                    setGeneratedPlan([]);
                    if (classId) {
                        setMonthPlans([]);
                        setIsConfigLoaded(false);
                        loadClassConfiguration(classId, year, m, duration, true);
                    }
                  }}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border bg-gray-50"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="w-24">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Duration</label>
                <select 
                  value={duration} 
                  onChange={(e) => {
                    const d = parseInt(e.target.value);
                    setDuration(d);
                    setIsGenerated(false);
                    setGeneratedPlan([]);
                    if (classId) {
                        setMonthPlans([]);
                        setIsConfigLoaded(false);
                        loadClassConfiguration(classId, year, startMonth, d, true);
                    }
                  }}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border bg-gray-50"
                >
                  <option value={3}>3 Mo</option>
                  <option value={4}>4 Mo</option>
                  <option value={6}>6 Mo</option>
                  <option value={12}>1 Yr</option>
                </select>
              </div>

              
          </div>
        </div>

          {/* Global Action Bar (Sticky) */}
          <div className="sticky top-0 z-20 bg-white shadow-md border border-gray-200 rounded-xl py-3 px-6 mb-6 flex flex-wrap justify-between items-center gap-4">
             {/* Legend */}
             <div className="text-xs text-gray-500 flex gap-4">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-indigo-50 border border-indigo-200 rounded-sm"></span>
                    <span>Class Day</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-100 border border-red-200 rounded-sm"></span>
                    <span>No Class</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-100 border border-green-200 rounded-sm"></span>
                    <span>Makeup</span>
                </div>
             </div>

             {/* Actions */}
             <div className="flex items-center gap-3">
                <button 
                    onClick={() => handleGenerate()}
                    disabled={loading || !classId || selectedDays.length === 0}
                    className={`
                        px-4 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-all
                        ${loading || !classId || selectedDays.length === 0
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md active:transform active:scale-95'}
                    `}
                >
                    {loading ? 'Generating...' : 'Preview Plan'}
                </button>
                <button 
                    onClick={handleDownloadPDF}
                    disabled={!isGenerated || isDownloading}
                    className={`
                        px-4 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-all flex items-center gap-2
                        ${!isGenerated || isDownloading
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gray-800 hover:bg-gray-900 hover:shadow-md active:transform active:scale-95'}
                    `}
                >
                    <Download className="w-4 h-4" />
                    {isDownloading ? 'Downloading...' : 'Download PDF'}
                </button>
                <button 
                    onClick={handleSharePDF}
                    disabled={!isGenerated || isSharing}
                    className={`
                        px-4 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-all flex items-center gap-2
                        ${!isGenerated || isSharing
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md active:transform active:scale-95'}
                    `}
                >
                    <Share className="w-4 h-4" />
                    {isSharing ? '공유 중...' : 'Share PDF'}
                </button>

             </div>
          </div>

          {/* Month List Container */}
          <div id="plan-container" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">

          {/* Monthly Plans List */}
          <div className="p-6 space-y-8 bg-gray-50/50 min-h-[300px]">
            {monthPlans.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <CalendarIcon className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-xl font-medium text-gray-500 mb-2">Please select a class to begin</p>
                <p className="text-sm text-gray-400">Configure the settings above to generate your curriculum.</p>
              </div>
            )}
            {monthPlans.map((plan, index) => (
              <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                   <div className="flex items-center gap-3">
                      <CalendarIcon className="h-5 w-5 text-indigo-600" />
                      <h3 className="font-bold text-gray-800 text-lg">
                        {MONTH_NAMES[plan.month]} {plan.year}
                      </h3>
                      {(() => {
                        // Calculate Assigned Sessions (Books)
                        const assignedBookSessions = plan.allocations.reduce((sum, a) => sum + (a.monthly_sessions || 0), 0);
                        
                        // Calculate Event Sessions
                        const eventSessions = Object.entries(specialDates).reduce((sum, [dStr, sd]) => {
                            if (sd.type !== 'school_event') return sum;
                            
                            // Check if this date is part of the current plan
                            const datesInPlan = planDates[plan.id] || [];
                            if (!datesInPlan.includes(dStr)) return sum;
                            
                            // Check Class Scope
                            if (sd.classes && sd.classes.length > 0 && classId) {
                                if (!sd.classes.includes(classId)) return sum;
                            }
                            
                            return sum + (sd.sessions || 0);
                        }, 0);
                        
                        const totalAssigned = assignedBookSessions + eventSessions;
                        
                        // Calculate Plan Capacity (based on fixed logic for now)
                        const daysCount = planDates[plan.id]?.length || 0;
                        // Dynamic slots per day based on selectedDays
                        const slotsPerDay = selectedDays.length === 2 ? 3 : (selectedDays.length === 1 ? 4 : 2);
                        const capacity = daysCount * slotsPerDay;
                        
                        const isMatch = totalAssigned === capacity;
                        const isOver = totalAssigned > capacity;
                        
                        return (
                          <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                isMatch 
                                    ? 'bg-green-100 text-green-700 border-green-200' 
                                    : (isOver ? 'bg-red-100 text-red-700 border-red-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200')
                              }`}>
                                {totalAssigned} / {capacity} Sessions
                              </span>
                              {!isMatch && (
                                  <span className="text-[10px] text-gray-500 font-medium">
                                      {isOver ? `${totalAssigned - capacity} Over` : `${capacity - totalAssigned} Left`}
                                  </span>
                              )}
                          </div>
                        );
                      })()}

                   </div>
                   <div className="flex items-center gap-2">
                     <button 
                        onClick={() => setExpandedMonthId(expandedMonthId === plan.id ? null : plan.id)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1 ${
                            expandedMonthId === plan.id 
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <CalendarIcon className="h-3 w-3" />
                        {expandedMonthId === plan.id ? 'Hide Calendar' : 'Manage Schedule'}
                      </button>
                      <button 
                        onClick={() => saveMonthlyPlan(plan.id)}
                        className="text-xs font-medium bg-green-600 text-white px-3 py-1.5 rounded-full hover:bg-green-700 transition-colors"
                      >
                        Save
                      </button>
                      <button 
                        onClick={() => setExpandedMonthId(plan.id)}
                        className="text-xs font-medium bg-yellow-500 text-white px-3 py-1.5 rounded-full hover:bg-yellow-600 transition-colors"
                      >
                        Edit
                      </button>
                   </div>
                </div>
                
                {/* Calendar View */}
                {expandedMonthId === plan.id && (
                    <div className="p-6 border-b border-gray-100 bg-gray-50">
                        <div className="grid grid-cols-7 gap-2 mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                <div key={d} className="text-center text-xs font-semibold text-gray-400 uppercase">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                            {(() => {
                                const year = plan.year;
                                const month = plan.month;
                                const firstOfMonth = new Date(year, month, 1);
                                const endOfMonth = new Date(year, month + 1, 0);
                                
                                const assignedDates = planDates[plan.id] || [];
                                // Sort assigned dates chronologically
                                const assignedDatesObj = assignedDates.map(d => parseLocalDate(d)).sort((a, b) => a.getTime() - b.getTime());
                                
                                const firstAssigned = assignedDatesObj.length > 0 ? assignedDatesObj[0] : firstOfMonth;
                                const lastAssigned = assignedDatesObj.length > 0 ? assignedDatesObj[assignedDatesObj.length - 1] : endOfMonth;
                                
                                // Effective Range: Include assigned dates even if outside current month
                                const effectiveStart = firstAssigned < firstOfMonth ? firstAssigned : firstOfMonth;
                                const effectiveEnd = lastAssigned > endOfMonth ? lastAssigned : endOfMonth;
                                
                                // Grid Start (Align to Sunday)
                                const startDayOfWeek = effectiveStart.getDay();
                                const gridStart = new Date(effectiveStart);
                                gridStart.setDate(gridStart.getDate() - startDayOfWeek);
                                
                                const days = [];
                                const current = new Date(gridStart);
                                
                                // Generate continuous grid
                                // Loop until we pass effectiveEnd AND complete the week
                                let iterations = 0;
                                while ((current <= effectiveEnd || days.length % 7 !== 0) && iterations < 100) {
                                    iterations++;
                                    // Use local date string to match getDatesForMonth and avoid timezone issues
                                    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
                                    const d = current.getDate();
                                    
                                    const isPrevMonth = current < firstOfMonth;
                                    const isNextMonth = current > endOfMonth;
                                    const isCurrentMonth = !isPrevMonth && !isNextMonth;
                                    
                                    const isAssigned = assignedDates.includes(dateStr);
                                    
                                    // Holiday/Special checks
                                    const special = specialDates[dateStr];
                                    const globalHoliday = holidays.find(h => h.date === dateStr);
                                    const isRelevantHoliday = globalHoliday && 
                                        (!globalHoliday.affected_classes || globalHoliday.affected_classes.length === 0 || globalHoliday.affected_classes.includes(classId));
                                    
                                    let content = null;

                                    if (isAssigned) {
                                        if (isPrevMonth) {
                                            // Rollover from Previous Month
                                            content = (
                                                <div key={dateStr} className="h-10 rounded-lg border flex flex-col items-center justify-center text-sm bg-indigo-50 border-indigo-200 text-indigo-700 font-medium ring-2 ring-indigo-300 ring-offset-1 z-10" title="Rollover from previous month">
                                                    {d}
                                                    <span className="text-[9px] leading-none opacity-75">Prev</span>
                                                </div>
                                            );
                                        } else {
                                            // Standard or Spillover to Next Month
                                            let statusClass = 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium';
                                            let title = 'Class Day';
                                            let label = null;

                                            if (special?.type === 'no_class') {
                                                statusClass = 'bg-red-100 border-red-200 text-red-700 font-bold';
                                                title = special.name || 'NO CLASS';
                                                label = special.name || 'No Class';
                                            } else if (special?.type === 'makeup') {
                                                statusClass = 'bg-green-100 border-green-200 text-green-700 font-bold';
                                                title = 'MAKEUP';
                                                label = 'Makeup';
                                            } else if (special?.type === 'school_event') {
                                                statusClass = 'bg-blue-100 border-blue-200 text-blue-700 font-bold';
                                                title = special.name;
                                                label = special.name;
                                            } else if (isRelevantHoliday) {
                                                statusClass = 'bg-red-50 border-red-200 text-red-600 font-bold';
                                                title = globalHoliday.name;
                                                label = globalHoliday.name;
                                            }
                                            
                                            const today = new Date();
                                            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                            if (dateStr === todayStr) statusClass += ' ring-2 ring-offset-1 ring-indigo-500';

                                            content = (
                                                <button
                                                    key={dateStr}
                                                    onClick={() => toggleDateStatus(dateStr)}
                                                    className={`h-10 rounded-lg border flex flex-col items-center justify-center text-sm transition-all hover:shadow-md ${statusClass} px-0.5`}
                                                    title={title}
                                                >
                                                    <span className="text-xs leading-none mb-0.5">{d}</span>
                                                    {label && <span className="text-[9px] leading-tight text-center break-words w-full truncate">{label}</span>}
                                                </button>
                                            );
                                        }
                                    } else {
                                        // Not assigned
                                        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][current.getDay()] as Weekday;
                                        const isClassDay = selectedDays.includes(dayName);

                                        if (isCurrentMonth && isClassDay) {
                                            // Active Month + Valid Class Day = Clickable White Box
                                            let statusClass = 'bg-white border-gray-200 text-gray-400';
                                            let title = 'No Class';
                                            let label = null;

                                            if (special?.type === 'no_class') {
                                                statusClass = 'bg-red-100 border-red-200 text-red-700 font-bold';
                                                title = 'NO CLASS';
                                                label = 'X';
                                            } else if (special?.type === 'makeup') {
                                                statusClass = 'bg-green-100 border-green-200 text-green-700 font-bold';
                                                title = 'MAKEUP';
                                                label = '+';
                                            } else if (special?.type === 'school_event') {
                                                statusClass = 'bg-blue-100 border-blue-200 text-blue-700 font-bold';
                                                title = special.name;
                                                if (special.name.includes('PBL')) label = 'PBL';
                                                else if (special.name.includes('정기')) label = 'TEST';
                                                else if (special.name.includes('100')) label = '100';
                                                else if (special.name.includes('Voc')) label = 'VOC';
                                                else label = special.name.substring(0, 3);
                                            } else if (isRelevantHoliday) {
                                                statusClass = 'bg-red-50 border-red-200 text-red-600 font-bold';
                                                title = globalHoliday.name;
                                                label = 'H';
                                            }

                                            content = (
                                                <button
                                                    key={dateStr}
                                                    onClick={() => toggleDateStatus(dateStr)}
                                                    className={`h-10 rounded-lg border flex flex-col items-center justify-center text-sm transition-all hover:shadow-md ${statusClass}`}
                                                    title={title}
                                                >
                                                    {d}
                                                    {label && <span className="text-[10px] leading-none">{label}</span>}
                                                </button>
                                            );
                                        } else {
                                            // Non-Class Day OR Not Current Month = Gray Box (Disabled)
                                            let bgClass = 'bg-gray-50 text-gray-300';
                                            if (isCurrentMonth && !isClassDay) {
                                                bgClass = 'bg-gray-100 text-gray-300';
                                            }
                                            
                                            content = (
                                                <div key={dateStr} className={`h-10 rounded-lg border border-transparent flex flex-col items-center justify-center text-sm ${bgClass}`}>
                                                    {d}
                                                </div>
                                            );
                                        }
                                    }
                                    
                                    days.push(content);
                                    current.setDate(current.getDate() + 1);
                                }
                                
                                return days;
                            })()}
                        </div>
                        <div className="mt-4 flex gap-4 text-xs text-gray-500 justify-center">
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-50 border border-indigo-200 rounded"></div> Class Day</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div> No Class</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div> Makeup</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div> School Event</div>
                        </div>
                    </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3 w-1/3">Book</th>
                        <th className="px-4 py-3 text-center">Section</th>
                        <th className="px-4 py-3 text-center">Weekly</th>
                        <th className="px-4 py-3 text-center">Order</th>
                        <th className="px-4 py-3 text-center">Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {plan.allocations.map((alloc, index) => {
                         // Fallback Strategy for UI: Global Books > Assigned Courses
                         const book = books.find(b => b.id === alloc.book_id) || 
                                      assignedCourses.find(c => c.book.id === alloc.book_id)?.book;
                         
                         const assignedCourse = assignedCourses.find(c => c.book.id === alloc.book_id);
                         
                         // Calculate Used Count (Sessions allocated for this month)
                         const academicMonthIndex = ((plan.month - 2 + 12) % 12) + 1;
                         const usedCount = assignedCourse?.sessions_by_month?.[academicMonthIndex] || 0;

                         return (
                          <tr key={alloc.id} className="group hover:bg-gray-50">
                            <td className="px-6 py-3">
                              <div className="flex flex-col">
                                <div className="text-sm font-medium text-gray-900">
                                  {book?.name || 'Unknown Book'}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                  {book?.level && <span>{book.level}</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                                {assignedCourse?.section || book?.category || '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                                {alloc.sessions_per_week || 2}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => moveAllocation(plan.id, alloc.id, 'up')}
                                  disabled={index === 0}
                                  className={`p-1 rounded hover:bg-gray-100 ${index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-indigo-600'}`}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => moveAllocation(plan.id, alloc.id, 'down')}
                                  disabled={index === plan.allocations.length - 1}
                                  className={`p-1 rounded hover:bg-gray-100 ${index === plan.allocations.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-indigo-600'}`}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">
                                {usedCount}
                            </td>
                          </tr>
                         );
                      })}
                      {/* School Events Row */}
                      {(() => {
                         // Find school events for this month
                         const year = plan.year;
                         const month = plan.month; // 0-11
                         
                         // Get all dates in this month
                         // Reuse getDatesForMonth logic or just filter specialDates keys
                         // But we need to know if they fall on class days if that matters?
                         // User said "put in the sessions in special_dates database should be calculated"
                         // So we should sum 'sessions' from special_dates.
                         
                         const events = Object.entries(specialDates).filter(([dStr, sd]) => {
                             if (sd.type !== 'school_event') return false;
                             const d = parseLocalDate(dStr);
                             return d.getFullYear() === year && d.getMonth() === month;
                         });
                         
                         // We might want to group by name
                         const groupedEvents: Record<string, number> = {};
                         
                         events.forEach(([dStr, sd]) => {
                            // Filter by class if applicable
                            if (sd.classes && sd.classes.length > 0 && classId) {
                                if (!sd.classes.includes(classId)) return;
                            }

                            const sessions = sd.sessions || 0; 
                            
                            const name = sd.name || 'School Event';
                            groupedEvents[name] = (groupedEvents[name] || 0) + sessions;
                        });
                         
                         return Object.entries(groupedEvents).map(([name, count]) => (
                            <tr key={name} className="group bg-blue-50/30">
                                <td className="px-6 py-3">
                                    <div className="flex flex-col">
                                        <div className="text-sm font-medium text-blue-900">
                                            {name}
                                        </div>
                                        <div className="text-xs text-blue-500 flex items-center gap-2 mt-1">
                                            <span>Event</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-gray-600">-</td>
                                <td className="px-4 py-3 text-center text-sm text-gray-600">-</td>
                                <td className="px-4 py-3 text-center text-sm text-gray-600">-</td>
                                <td className="px-4 py-3 text-center text-sm font-bold text-blue-900">
                                    {count}
                                </td>
                            </tr>
                         ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
             <div className="text-sm text-gray-500">
                Configure your plan above and click Preview Plan to generate.
             </div>
          </div>
        </div>
      </div>

      {/* Output / Printable Area */}
      {isGenerated && (
        <>
          <style>{`
            @media print {
              @page { margin: 15mm; }
              html, body { height: auto; }
              #results { max-height: none !important; overflow: visible !important; box-shadow: none !important; }
              .date-card { page-break-inside: avoid; }
              .print-title { margin-bottom: 4px; }
              .print-sub { margin-top: 0; font-size: 12px; color: #6b7280; }
              .no-print { display: none !important; }
              .print-only { display: block !important; }
              .pdf-root { font-family: 'Pretendard', sans-serif; }
              .pdf-title { text-align: center; font-size: 28px; font-weight: 800; }
              .pdf-sub { text-align: center; margin-bottom: 20px; }
              .pdf-month { font-size: 22px; margin: 20px 0; border-bottom: 3px solid #000; }
              .pdf-table { width: 100%; border-collapse: collapse; }
              .pdf-date { width: 140px; vertical-align: top; font-weight: 700; border-right: 2px solid #333; padding: 10px; }
              .pdf-content { padding: 10px; }
              .pdf-content div { margin-bottom: 4px; }
              .scp-line { color: #f59e0b; font-weight: 600; }
            }
            @media screen {
              .print-only { display: none !important; }
              #pdf-content .print-only { display: block !important; }
            }
          `}</style>
          <div id="results" className="mt-12 bg-white shadow-lg rounded-xl border border-gray-200 scroll-mt-8 max-h-[85vh] overflow-y-auto">
          <div className="p-8 border-b border-gray-200 flex justify-between items-center bg-gray-50 no-print">
            <div>
              <p className="text-sm text-gray-500">{generatedPlan.length} sessions scheduled</p>
            </div>
            <button 
              onClick={() => { handleSaveAll(); }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm"
            >
              <Save className="h-4 w-4" />
              Save All Changes
            </button>
            <button 
              onClick={() => { handleDownloadPDF(); }}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              {isDownloading ? 'Downloading...' : 'Download PDF'}
            </button>
          </div>

          {/* Screen Preview (grid, hidden on print) */}
          <div id="preview-root" className="p-8 no-print">
            {generatedPlan.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <p className="text-lg font-medium mb-2">No lessons generated.</p>
                    <p className="text-sm">Please check if you have assigned books and selected valid schedule days.</p>
                </div>
            ) : (
                /* Group by Month Plan for Display (Plan-based View) */
                monthPlans.map((plan, index, array) => {
                    const allocatedDates = planDates[plan.id] || [];
                    const lessons = generatedPlan.filter(l => allocatedDates.includes(l.date));
                    
                    if (lessons.length === 0) return null;

                    const y = plan.year;
                    const m = plan.month;
                    const key = plan.id;
                    
                    // Group by Date for grid
                    const byDate: Record<string, LessonPlan[]> = {};
                    lessons.forEach(l => {
                        if (!byDate[l.date]) byDate[l.date] = [];
                        byDate[l.date].push(l);
                    });
                    
                    const uniqueDates = Object.keys(byDate).sort((a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime());
                    
                    // Logic for fixed Grid (3 days)
                    const isFixedGrid = selectedDays.length === 3;
                    const cols = isFixedGrid ? 3 : 2; 
                    
                    let rows: (string | null)[][] = [];

                    // Simple chunking (no gaps)
                    for (let i = 0; i < uniqueDates.length; i += cols) {
                        rows.push(uniqueDates.slice(i, i + cols));
                    }

                    return (
                        <div key={key} className={index < array.length - 1 ? "mb-12 print:break-after-page" : ""} style={index < array.length - 1 ? { pageBreakAfter: 'always' } : {}}>
                            <div className="mb-6 text-center border-b border-gray-200 pb-4">
                                <h2 className="text-2xl font-bold text-gray-800">{MONTH_NAMES[m]} {y}</h2>
                                <p className="text-gray-500 text-sm mt-1 mb-2">{className}</p>
                                
                                {/* Session Capacity Indicator */}
                                {(() => {
                                    const plan = monthPlans.find(p => p.year === y && p.month === m);
                                    if (!plan) return null;
                                    
                                    // Calculate Assigned from Allocations (Books)
                                    const assignedBooks = plan.allocations.reduce((sum, a) => sum + (a.monthly_sessions || 0), 0);
                                    
                                    // Calculate Event Sessions
                                    const eventSessions = Object.entries(specialDates).reduce((sum, [dStr, sd]) => {
                                        if (sd.type !== 'school_event') return sum;
                                        const d = parseLocalDate(dStr);
                                        if (d.getFullYear() !== y || d.getMonth() !== m) return sum;
                                        
                                        // Check Class Scope
                                        if (sd.classes && sd.classes.length > 0 && classId) {
                                            if (!sd.classes.includes(classId)) return sum;
                                        }
                                        
                                        return sum + (sd.sessions || 0);
                                    }, 0);
                                    
                                    const assigned = assignedBooks + eventSessions;
                                    
                                    // Calculate Capacity from Valid Calendar Dates
                                    // We use the computed planDates which contains all valid dates (excluding holidays)
                                    const dates = planDates[plan.id] || [];
                                    const capacity = dates.length * 2; // Assuming 2 periods per day
                                    
                                    const isMatch = assigned === capacity;
                                    const isOver = assigned > capacity;
                                    const isUnder = assigned < capacity;
                                    
                                    let badgeColor = 'bg-green-100 text-green-700 border-green-200';
                                    if (isOver) badgeColor = 'bg-red-100 text-red-700 border-red-200';
                                    if (isUnder) badgeColor = 'bg-yellow-100 text-yellow-700 border-yellow-200';
                                    
                                    return (
                                        <div className="flex justify-center items-center gap-2 mt-2">
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${badgeColor} flex items-center gap-1.5`}>
                                                <span>Assigned: {assigned}</span>
                                                <span className="text-gray-400">/</span>
                                                <span>Capacity: {capacity}</span>
                                            </span>
                                            {isUnder && (
                                                <span className="text-xs text-gray-500">
                                                    ({capacity - assigned} slots empty)
                                                </span>
                                            )}
                                            {isOver && (
                                                <span className="text-xs text-red-500 font-medium">
                                                    ({assigned - capacity} sessions will be cut)
                                                </span>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="space-y-6">
                                {rows.map((rowDates, ri) => (
                                    <div key={ri} className={`grid gap-6 ${isFixedGrid ? 'grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                                        {rowDates.map((dateStr, colIdx) => {
                                            if (!dateStr) {
                                                return <div key={`empty-${ri}-${colIdx}`} className="invisible md:visible border-2 border-dashed border-gray-100 rounded-xl min-h-[150px]" />;
                                            }
                                            const dayLessons = (byDate[dateStr] || []).sort((a, b) => (a.period || 0) - (b.period || 0));
                                            const dateObj = parseLocalDate(dateStr);
                                            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                                            
                                            return (
                                                <div 
                                                    key={dateStr}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, dateStr)}
                                                    className="bg-white rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-300 transition-colors flex flex-col overflow-hidden h-full min-h-[150px]"
                                                >
                                                    {/* Date Header */}
                                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-baseline">
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-xl font-bold text-gray-900">{dateObj.getMonth() + 1}/{dateObj.getDate()}</span>
                                                            <span className="text-sm font-medium text-gray-500 uppercase">{dayName}</span>
                                                        </div>
                                                        <span className="text-xs text-gray-400 font-medium">{dayLessons.length} Tasks</span>
                                                    </div>
                                                    
                                                    {/* Lessons List */}
                                                    <div className="p-3 space-y-2 flex-1">
                                                        {dayLessons.map(lesson => {
                                                            const isNoClass = lesson.book_id === 'no_class';
                                                            const isSchoolEvent = lesson.book_id === 'school_event';
                                                            
                                                            let bgClass = 'bg-white border-gray-200 hover:shadow-md hover:border-indigo-300 cursor-move active:scale-[0.98]';
                                                            let textClass = 'text-gray-900';
                                                            let subTextClass = 'text-gray-500';

                                                            if (isNoClass) {
                                                                bgClass = 'bg-red-50 border-red-100 cursor-default';
                                                                textClass = 'text-red-700';
                                                                subTextClass = 'text-red-600';
                                                            } else if (isSchoolEvent) {
                                                                bgClass = 'bg-blue-50 border-blue-100 cursor-default';
                                                                textClass = 'text-blue-700';
                                                                subTextClass = 'text-blue-600';
                                                            }

                                                            return (
                                                                <div
                                                                    key={lesson.id}
                                                                    draggable={!isNoClass && !isSchoolEvent}
                                                                    onDragStart={(e) => handleDragStart(e, lesson.id)}
                                                                    onDrop={(e) => handleDrop(e, dateStr, lesson.id)}
                                                                    className={`
                                                                        group relative p-3 rounded-lg border shadow-sm transition-all
                                                                        ${bgClass}
                                                                    `}
                                                                >
                                                                    <div className="flex justify-between items-start gap-2">
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className={`font-semibold text-sm truncate ${textClass}`}>
                                                                                {lesson.books?.name || lesson.book_name}
                                                                            </p>
                                                                            <p className={`text-xs mt-0.5 ${subTextClass}`}>
                                                                                {lesson.content}
                                                                            </p>
                                                                        </div>
                                                                        {!isNoClass && !isSchoolEvent && (
                                                                            <GripVertical className="h-4 w-4 text-gray-300 group-hover:text-indigo-400" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {dayLessons.length === 0 && (
                                                            <div className="h-full flex items-center justify-center text-xs text-gray-300 italic py-4">
                                                                Drop items here
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })
            )}
          </div>
          
          {/* Hidden PDF Render Container (Visible only in Print) */}
          <div id="pdf-content" className="print-only pdf-safe">
              <PdfLayout
                lessons={generatedPlan}
                className={className}
                selectedDays={selectedDays}
                timeRange={`${startTime}~${endTime}`}
                monthPlans={monthPlans}
                planDates={planDates}
              />
          </div>
        </div>
        </>
      )}
    </div>
  );
}
