//app/dashboard/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useData } from '@/context/store';
import { calculateBookDistribution } from '@/lib/logic';
import { generateLessons } from '@/lib/lessonEngine';
import { parseLocalDate } from '@/lib/date';
import PdfLayout from '@/components/PdfLayout';
import { BookAllocation, LessonPlan, Weekday, Book, SpecialDate } from '@/types';
import { Play, Download, Trash2, Plus, Calendar as CalendarIcon, Copy, XCircle, ArrowUp, ArrowDown, HelpCircle, GripVertical, Save } from 'lucide-react';

async function exportPdf(_element: HTMLElement) {
  void _element;
  window.print();
}

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
  holidays: { date: string }[],
  specialDates: Record<string, SpecialDate> = {}
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
      const isHoliday = holidays.some(h => h.date === dateStr);
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
        const res = await fetch('/api/calendar');
        if (!res.ok) throw new Error('Failed to fetch calendar data');
        const { holidays: h, special_dates: s } = await res.json();

        setHolidays(h || []);

        const map: Record<string, SpecialDate> = {};
        (s ?? []).forEach((d: any) => {
          map[d.date] = { type: d.type, name: d.name };
        });
        setSpecialDates(map);
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
  const [duration, setDuration] = useState(3); // Default 3 months
  const [selectedDays, setSelectedDays] = useState<Weekday[]>([]);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

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
    // Determine Fixed Sessions per Month
    const fixedSessions = selectedDays.length === 2 ? 8 : (selectedDays.length === 3 ? 12 : selectedDays.length * 4);
    
    // 1. Generate ALL valid dates for the entire duration + buffer
    // We iterate through the months defined by monthPlans, but maybe we need more if overflow happens?
    // Actually, monthPlans defines the containers. We fill them.
    // If we run out of dates, the last plan might be empty or partial.
    // If we have too many dates, they just don't fit in the defined plans (or we could extend, but duration is fixed).
    
    // To ensure we have enough candidates, we might need to scan beyond the last plan's month
    // if the earlier months were "sparse" (less than 8/12). 
    // BUT, the requirement says "Excess dates flow". Sparse months would borrow from next?
    // "초과되는 날짜는 무조건 다음 달로 이월" -> Overflow flows.
    // If a month has 7 valid dates but needs 8? Then it takes from next month?
    // The prompt focuses on "Excess". Let's assume we just fill the slots sequentially.
    
    const allValidDates: string[] = [];
    
    // We need a continuous timeline.
    // Let's iterate from the start month of the first plan, for enough months to cover the duration.
    // Safety buffer: duration + 2 months to catch overflows.
    if (monthPlans.length === 0) return {};

    const firstPlan = monthPlans[0];
    let currentY = firstPlan.year;
    let currentM = firstPlan.month;
    
    // Generate a pool of dates
    for (let i = 0; i < monthPlans.length + 2; i++) {
        const dates = getDatesForMonth(currentY, currentM, selectedDays, holidays, specialDates);
        // Sort just in case
        dates.sort((a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime());
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
        const assignedDates = allValidDates.slice(dateCursor, dateCursor + slotsNeeded);
        distributed[plan.id] = assignedDates;
        dateCursor += slotsNeeded;
    });
    
    return distributed;
  }, [monthPlans, selectedDays, holidays, specialDates]);

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
      console.log('[DEBUG assigned-courses] Fetched courses:', JSON.stringify(courses, null, 2));

      if (courses.length > 0) {
        console.log('[DEBUG assigned-courses] First course sessions:', courses[0].sessions_by_month);
        console.log('[DEBUG assigned-courses] Keys:', Object.keys(courses[0].sessions_by_month));
      }
      
      const newPlans: MonthPlan[] = [];
      
      Array.from({ length: cDuration }).forEach((_, idx) => {
         const totalMonths = cStartMonth + idx;
         const m = totalMonths % 12;
         const y = cYear + Math.floor(totalMonths / 12);
         
         // Calculate Academic Month Index (March = 1, April = 2, ..., Feb = 12)
         // Month is 0-based index from Date object (0=Jan, 1=Feb, 2=Mar)
         // If m=2 (Mar), index=1. m=3 (Apr), index=2.
         // Formula: ((m - 2 + 12) % 12) + 1
         const academicMonthIndex = ((m - 2 + 12) % 12) + 1;
         
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
        nextData = { type: 'school_event', name: 'PBL' };
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
    const allLessons = generateLessons({
      classId,
      monthPlans,
      planDates,
      selectedDays,
      books: effectiveBooks,
      scpType: classes.find(c => c.id === classId)?.scp_type ?? null
    });
    const targetPlan = monthPlans.find(p => p.id === monthId);
    if (!targetPlan) return [];
    return allLessons.filter(l => {
      const [y, m] = l.date.split('-').map(Number);
      return y === targetPlan.year && (m - 1) === targetPlan.month;
    });
  };

  // Removed specialDates reset effect to avoid setState in effect

  const saveMonthlyPlan = async (monthId: string) => {
    const monthly = getPlansForMonth(monthId);
    const target = monthPlans.find(p => p.id === monthId);
    if (!target) return;

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

      alert('해당 월 플랜을 Supabase에 저장했습니다.');
    } catch (e: any) {
      console.error('Save failed:', e);
      alert(`저장 실패: ${e.message}`);
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

  const downloadPDF = () => {
    const element = document.getElementById('pdf-root');
    if (!element) return;
    exportPdf(element);
  };

  const handleGenerate = (targetMonthId?: string) => {
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

    const allLessons = generateLessons({
      classId,
      monthPlans,
      planDates,
      selectedDays,
      books,
      scpType: classes.find(c => c.id === classId)?.scp_type ?? null
    });

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
            
            // Check if it is no_class
            const special = specialDates[dateStr];
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
                });
            }
        }
    });

    let allPlans: LessonPlan[] = [...allLessons, ...noClassLessons].sort((a, b) => {
        const da = parseLocalDate(a.date);
        const db = parseLocalDate(b.date);
        if (da.getTime() !== db.getTime()) return da.getTime() - db.getTime();
        return (a.period || 0) - (b.period || 0);
    });

    if (targetMonthId) {
      const targetPlan = monthPlans.find(p => p.id === targetMonthId);
      if (targetPlan) {
        // Filter plans for this month
        const monthlyPlans = allPlans.filter(l => {
          // Parse YYYY-MM-DD manually to avoid UTC conversion issues
          const [y, m] = l.date.split('-').map(Number);
          return (m - 1) === targetPlan.month && y === targetPlan.year;
        });
        
        // If specific month generation yields results, show only that.
        if (monthlyPlans.length > 0) {
            allPlans = monthlyPlans;
            const monthName = MONTH_NAMES[targetPlan.month];
            const fileName = `LessonPlan_${className}_${monthName}_${targetPlan.year}`;
            setPageTitle(fileName);
        } else {            
            // Check if sessions were actually assigned for this month.
            const m = targetPlan.month; // 0-11
            // Calculate Academic Month Index (March = 1, ..., Feb = 12)
            const academicMonthIndex = ((m - 2 + 12) % 12) + 1;
            
            const hasAssignedSessions = assignedCourses.some(c => (c.sessions_by_month?.[academicMonthIndex] || 0) > 0);

            if (!hasAssignedSessions) {
                 alert(`No sessions scheduled for ${MONTH_NAMES[targetPlan.month]}. This class has books, but no sessions assigned to this month.`);
            } else {
                 // Sessions exist, but generator produced nothing (e.g. no valid dates)
                 alert(`Warning: Sessions are assigned for ${MONTH_NAMES[targetPlan.month]}, but no lessons could be generated. Please check holidays or schedule days.`);
            }
            
            allPlans = []; // Show empty
        }
      }
    } else {
        // Generate All
        setPageTitle(`LessonPlan_${className}_All_Months_${year}`);
    }

    setGeneratedPlan(allPlans);
    setIsGenerated(true);
    requestAnimationFrame(() => {
      const el = document.getElementById('preview-root');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    if (allPlans.length === 0) {
        alert('수업이 생성되지 않았습니다. 다음을 확인해주세요:\n1. 교재의 "Weekly Sessions"가 0이 아닌지\n2. 선택한 요일이 달력에 존재하는지');
    }
  };
  
  // 미리보기 초기화는 연도/시작월 변경 이벤트 핸들러에서 수행
  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header / No Print */}
      <div className="no-print">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Plan Generator</h1>
          <p className="text-gray-500">Configure monthly curriculum and track remaining sessions.</p>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          {/* Top Settings Bar */}
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-6 items-start">
              <div className="w-full md:w-64">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Class Name</label>
                <select 
                  value={classId} 
                  onChange={handleClassSelect}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border bg-white"
                >
                  <option value="">Select a Class</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[240px]">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Schedule Days</label>
                <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {ALL_WEEKDAYS.map(day => (
                    <button
                      key={day}
                      onClick={() => handleDayToggle(day)}
                      className={`
                        px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap
                        ${selectedDays.includes(day) 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}
                      `}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                {classId && selectedDays.length === 0 && (
                  <p className="text-xs text-red-500 mt-1 font-medium">⚠️ No days selected. Please select at least one.</p>
                )}
              </div>

              <div className="w-36">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Academic Year</label>
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

              <div className="w-36">
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

              <div className="w-36">
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
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={12}>1 Year</option>
                </select>
              </div>

              
          </div>

          {/* (removed) Monthly Curriculum Grid */}

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
                        const sessionsPerMonth = selectedDays.length === 2 ? 8 : (selectedDays.length === 3 ? 12 : selectedDays.length * 4);
                        return (
                          <span className="text-xs font-medium px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                            {sessionsPerMonth} Sessions
                          </span>
                        );
                      })()}

                   </div>
                   <div className="flex items-center gap-2">
                     <button 
                        onClick={() => {
                          handleGenerate(plan.id);
                        }}
                        disabled={selectedDays.length === 0}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors shadow-sm ${
                            selectedDays.length === 0 
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        <Play className="h-3 w-3 fill-current" /> Generate
                      </button>
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
                                                title = 'NO CLASS';
                                                label = 'No Class';
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
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-500 flex gap-4">
                <div className="flex items-center gap-1">
                    <Play className="h-4 w-4 text-indigo-600" />
                    <span>Preview Plan: 플랜 미리보기</span>
                </div>
                <div className="flex items-center gap-1">
                    <Download className="h-4 w-4 text-gray-600" />
                    <span>Download PDF: 미리보기 내용 저장</span>
                </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleGenerate()}
                disabled={monthPlans.every(p => p.allocations.length === 0)}
                title={monthPlans.every(p => p.allocations.length === 0) ? "교재를 먼저 추가해주세요" : "설정된 기간의 플랜을 미리보기로 생성"}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium shadow-sm transition-all text-base
                  ${monthPlans.every(p => p.allocations.length === 0)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg active:scale-95'}
                `}
              >
                <Play className="h-4 w-4" />
                Preview Plan
              </button>
              <button
                onClick={() => downloadPDF()}
                disabled={!isGenerated || generatedPlan.length === 0}
                title={!isGenerated ? "먼저 플랜을 미리보기로 생성하세요" : "PDF로 저장"}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium shadow-sm transition-all text-base
                  ${(!isGenerated || generatedPlan.length === 0)
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}
                `}
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Output / Printable Area */}
      {isGenerated && (
        <>
          <style>{`
            @media print {
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
            }
          `}</style>
          <div id="results" className="mt-12 bg-white shadow-lg rounded-xl border border-gray-200 scroll-mt-8 max-h-[85vh] overflow-y-auto">
          <div className="p-8 border-b border-gray-200 flex justify-between items-center bg-gray-50 no-print">
            <div>
              <p className="text-sm text-gray-500">{generatedPlan.length} sessions scheduled</p>
            </div>
            <button 
              onClick={() => { downloadPDF(); }}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              Re-Download PDF
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
                /* Group by Month for Display */
                Object.entries(generatedPlan.reduce((groups, lesson) => {
              const d = parseLocalDate(lesson.date);
              const key = `${d.getFullYear()}-${d.getMonth()}`;
              if (!groups[key]) groups[key] = [];
              groups[key].push(lesson);
              return groups;
            }, {} as Record<string, LessonPlan[]>)).map(([key, lessons], index, array) => {
              const [y, m] = key.split('-').map(Number);
              
              return (
                <div key={key} className={index < array.length - 1 ? "mb-12 print:break-after-page" : ""} style={index < array.length - 1 ? { pageBreakAfter: 'always' } : {}}>
                   <div className="mb-2 text-center">
                      <h1 className="text-xl font-bold text-gray-900">{className} Lesson Plan</h1>
                      <p className="text-gray-600 text-xs">
                        {selectedDays.join(' ')} {startTime}~{endTime} • {MONTH_NAMES[m]} {y} [
                          {(() => {
                            const monthDates = lessons.map(l => l.date).sort((a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime());
                            if (monthDates.length === 0) return '';
                            const s = parseLocalDate(monthDates[0]);
                            const e = parseLocalDate(monthDates[monthDates.length - 1]);
                            const fmt = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`;
                            return `${fmt(s)} ~ ${fmt(e)}`;
                          })()}
                        ]
                      </p>
                   </div>

                   <div className="space-y-6">
                     {(() => {
                       const byDate: Record<string, LessonPlan[]> = {};
                       lessons.forEach(l => {
                         if (!byDate[l.date]) byDate[l.date] = [];
                         byDate[l.date].push(l);
                       });
                       const uniqueDates = Object.keys(byDate).sort((a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime());
                       const cols = 2;
                       const rows: string[][] = [];
                       for (let i = 0; i < uniqueDates.length; i += cols) {
                         rows.push(uniqueDates.slice(i, i + cols));
                       }
                       return rows.map((datesRow, ri) => (
                        <div key={ri} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {datesRow.map((dStr) => {
                            const list = (byDate[dStr] || []).sort((a, b) => {
                              const pa = typeof a.period === 'number' ? a.period : 0;
                              const pb = typeof b.period === 'number' ? b.period : 0;
                              return pa - pb;
                             });
                              const dd = parseLocalDate(dStr);
                              const monthNum = dd.getMonth()+1;
                              const dayNum = dd.getDate();
                              const weekday = dd.toLocaleDateString('en-US',{weekday:'short'});
                              const parseUD = (s?: string) => {
                                const m = s?.match(/Unit\s+(\d+)\s+Day\s+(\d+)/i);
                                const u = m ? parseInt(m[1]) : undefined;
                                const d = m ? parseInt(m[2]) : undefined;
                                return { u, d };
                              };
                              const isTrophyContent = (s?: string) => {
                                if (!s) return false;
                                return /^[A-Za-z0-9]+-\d+\s+Day\s+\d+$/i.test(s.trim());
                              };
                              const formatUD = (u?: number, d?: number, fallback?: string) => {
                                if (typeof u === 'number' && typeof d === 'number') return `Unit ${u} Day ${d}`;
                                return fallback || '';
                              };
                              const onDropCard = (srcId: string, tgtId: string) => {
                                if (!srcId || !tgtId || srcId === tgtId) return;
                                const src = generatedPlan.find(l => l.id === srcId);
                                const tgt = generatedPlan.find(l => l.id === tgtId);
                                if (!src || !tgt || src.date !== tgt.date || src.date !== dStr) return;
                                const dateList = generatedPlan.filter(l => l.date === dStr).sort((a, b) => {
                                  const pa = typeof a.period === 'number' ? a.period : 0;
                                  const pb = typeof b.period === 'number' ? b.period : 0;
                                  return pa - pb;
                                });
                                const ids = dateList.map(l => l.id);
                                const si = ids.indexOf(srcId);
                                const ti = ids.indexOf(tgtId);
                                if (si < 0 || ti < 0) return;
                                ids.splice(si, 1);
                                ids.splice(ti, 0, srcId);
                                setGeneratedPlan(prev => {
                                  const next = prev.map(l => ({ ...l }));
                                  const mapIdx: Record<string, number> = {};
                                  ids.forEach((id, idx) => { mapIdx[id] = idx + 1; });
                                  for (const l of next) {
                                    if (l.date === dStr && typeof mapIdx[l.id] === 'number') {
                                      l.period = mapIdx[l.id];
                                    }
                                  }
                                  return next;
                                });
                              };
                              return (
                                <div key={dStr} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                  <div className="px-4 py-3 bg-slate-50 text-slate-700 font-medium flex items-center justify-between border-b border-slate-200">
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-2xl font-semibold tracking-tight text-slate-900">{monthNum}/{dayNum}</span>
                                      <span className="text-xs font-medium uppercase text-slate-500">{weekday}</span>
                                    </div>
                                  </div>
                                  <div
                                    className="p-2 space-y-1"
                                  >
                                    {list.map(item => {
                                      if (item.book_id === 'no_class') {
                                        return (
                                          <div key={item.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                            <span className="text-xs font-semibold text-amber-700">NO CLASS</span>
                                            <span className="text-sm font-medium text-amber-900">{item.unit_text || 'No Class'}</span>
                                          </div>
                                        );
                                      }
                                      const { u, d } = parseUD(item.content);
                                      const hasUD = typeof u === 'number' && typeof d === 'number';
                                      return (
                                        <div
                                          key={item.id}
                                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="text-sm font-semibold text-slate-900">{item.book_name}</div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {isTrophyContent(item.content) ? (
                                              <span className="text-xs font-medium text-slate-700">{item.content || ''}</span>
                                            ) : hasUD ? (
                                              <>
                                                <span className="text-xs text-slate-500">Unit</span>
                                                <input
                                                  type="number"
                                                  min={1}
                                                  value={u}
                                                  onChange={(e) => {
                                                    const nu = parseInt(e.target.value) || 1;
                                                    setGeneratedPlan(prev => prev.map(l => l.id === item.id ? { ...l, content: formatUD(nu, d, item.content) } : l));
                                                  }}
                                                  className="w-14 px-2 py-1 border rounded text-xs"
                                                />
                                                <span className="text-xs text-slate-500">Day</span>
                                                <input
                                                  type="number"
                                                  min={1}
                                                  value={d}
                                                  onChange={(e) => {
                                                    const nd = parseInt(e.target.value) || 1;
                                                    setGeneratedPlan(prev => prev.map(l => l.id === item.id ? { ...l, content: formatUD(u, nd, item.content) } : l));
                                                  }}
                                                  className="w-14 px-2 py-1 border rounded text-xs"
                                                />
                                              </>
                                            ) : (
                                              <>
                                                <span className="text-xs text-slate-500">Content</span>
                                                <input
                                                  type="text"
                                                  value={item.content || ''}
                                                  onChange={(e) => {
                                                    const val = e.target.value;
                                                    setGeneratedPlan(prev => prev.map(l => l.id === item.id ? { ...l, content: val } : l));
                                                  }}
                                                  className="w-40 px-2 py-1 border rounded text-xs"
                                                />
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                       ));
                    })()}
                  </div>
               </div>
              );
            }))}
          </div>
          
          {/* Print-only PDF layout */}
          <PdfLayout
            lessons={generatedPlan}
            className={className}
            selectedDays={selectedDays}
            timeRange={`${startTime}~${endTime}`}
          />
        </div>
        </>
      )}
    </div>
  );
}

