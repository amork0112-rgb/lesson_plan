'use client';

import { useState, useMemo, useEffect } from 'react';
import { useData } from '@/context/store';
import { generateClassDates, generateLessonPlan, calculateBookDistribution } from '@/lib/logic';
import { Class, BookAllocation, ScheduleRule, LessonPlan, Weekday, Book } from '@/types';
import { Settings, Play, Download, Trash2, Plus, Calendar as CalendarIcon, Copy, ChevronRight, AlertCircle, CheckCircle, XCircle, ArrowUp, ArrowDown, HelpCircle, BookOpen, FileText } from 'lucide-react';

// --- Types ---
interface MonthPlan {
  id: string;
  year: number;
  month: number; // 0-11
  allocations: BookAllocation[];
}

type SpecialDateType = 'event' | 'makeup';

interface SpecialDate {
  type: SpecialDateType;
  name: string;
}

// --- Helpers ---
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ALL_WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDatesForMonth(
  year: number,
  month: number,
  selectedDays: Weekday[],
  holidays: any[],
  specialDates: Record<string, SpecialDate> = {}
): string[] {
  const dates: string[] = [];
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // Last day of month
  const allowedDays = new Set(selectedDays);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const special = specialDates[dateStr];

    // If it's an event (cancellation), skip it regardless of weekday
    if (special?.type === 'event') {
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
        // Use local date string construction to avoid timezone shifts
        const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.push(localDateStr);
      }
    }
  }
  
  return dates;
}

function calculateMonthUsage(
  dates: string[],
  allocations: BookAllocation[],
  classId: string
): Record<string, number> {
  // 1. Create Rules from selected days (we assume dates are already filtered by selectedDays)
  // Actually calculateBookDistribution needs rules to map weekday -> book.
  // We can construct synthetic rules for the allowed days.
  // But wait, allocations define the distribution pattern.
  // We need to know which weekday maps to which book.
  
  // We need the full set of rules for the class to determine the pattern.
  // But here we only have allocations.
  // The pattern is derived from allocations + available weekdays.
  // If selectedDays are Mon, Wed, Fri, we need rules for Mon, Wed, Fri.
  
  // Let's assume the rules are just "All selected days are active".
  // But we need to know WHICH day gets WHICH book.
  // This depends on the rules passed to calculateBookDistribution.
  
  // We can infer the rules from the dates.
  const weekdaysInMonth = new Set<Weekday>();
  dates.forEach(d => {
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateObj = new Date(d);
    weekdaysInMonth.add(dayMap[dateObj.getDay()] as Weekday);
  });
  
  const rules: ScheduleRule[] = Array.from(weekdaysInMonth).map(d => ({
    id: `rule_${d}`,
    class_id: classId,
    weekday: d
  }));
  
  const distribution = calculateBookDistribution(allocations, rules);
  
  const usage: Record<string, number> = {};
  dates.forEach(d => {
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateObj = new Date(d);
    const dayName = dayMap[dateObj.getDay()];
    const bookId = distribution[dayName];
    if (bookId) {
      usage[bookId] = (usage[bookId] || 0) + 1;
    }
  });
  
  return usage;
}


export default function Home() {
  const { books, holidays, classes } = useData();
  
  // -- Global Settings --
  const [className, setClassName] = useState('A1a');
  const [classId, setClassId] = useState('c1');
  const [year, setYear] = useState(2026);
  const [selectedDays, setSelectedDays] = useState<Weekday[]>(['Mon', 'Wed', 'Fri']);
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:30');
  
  // -- Special Dates --
  const [specialDates, setSpecialDates] = useState<Record<string, SpecialDate>>({});
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);

  // -- Monthly Plans --
  const [monthPlans, setMonthPlans] = useState<MonthPlan[]>([]);
  
  // Initialize with March -> Feb next year when year changes or initially
  useEffect(() => {
    // Only if empty, to prevent overwriting user edits?
    // User wants "Show all from March to Feb".
    // Let's reset/init based on the selected year.
    // If user changes year, we regen? Yes.
    
    // Check if we already have plans for this year/range?
    // To allow persistence during session, we might want to check.
    // But simplicity first: Regen on year change.
    
    if (monthPlans.length > 0 && monthPlans[0].year === year && monthPlans[0].month === 2) {
       // Already initialized for this year (March start)
       return;
    }
    
    const newPlans: MonthPlan[] = [];
    let currentYear = year;
    // Start from March (month index 2)
    // Sequence: 2,3,4,5,6,7,8,9,10,11,0,1
    const monthsSequence = [2,3,4,5,6,7,8,9,10,11,0,1];
    
    monthsSequence.forEach((m, idx) => {
       // If m is 0 or 1, it means next year
       const y = (m === 0 || m === 1) ? year + 1 : year;
       
       newPlans.push({
         id: `m_${y}_${m}`,
         year: y,
         month: m,
         allocations: idx === 0 ? [
            // Default allocation for first month
            { id: `a_${y}_${m}_1`, class_id: classId, book_id: books[0]?.id || '', sessions_per_week: 2, priority: 1, total_sessions_override: 48 },
         ] : [] 
       });
    });
    
    setMonthPlans(newPlans);
  }, [year, classId]); // Re-run when year changes. What about allocations? We lose them if we reset.
  // Ideally, we should merge or only init if empty.
  // But for MVP, resetting on year change is acceptable behavior (New Year -> New Plan).
  
  // Also, when adding allocations to subsequent months, we might want to copy from previous?
  // The user asked for "Copy from previous" checkbox before.
  // Now with pre-generated months, "Copy" means "Fill this empty month with previous month's config".
  
  // Let's update `handleAddMonth` -> `handleFillMonth` logic?
  // The user sees 12 cards. Empty ones have "0 Allocations".
  // We can add a "Copy from previous month" button on empty months.

  // -- Output --
  const [isGenerated, setIsGenerated] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<LessonPlan[]>([]);
  const [showGuide, setShowGuide] = useState(true);

  // -- Computed Usage & Flow --
  // We calculate the flow of sessions: Start -> Used -> Remaining -> Next Start
  
  // Filter books based on selected class
  const filteredBooks = useMemo(() => {
    if (!className) return books;
    
    // Normalize class name for matching
    // e.g. "R1a/R1b" -> "r1ar1b", "M2" -> "m2"
    const cName = className.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const matches = books.filter(b => {
      if (!b.level) return false;
      const bLevel = b.level.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Check for mutual inclusion
      // 1. Class "A1a" contains Book "A1" (if exists) -> true
      // 2. Book "M2A" contains Class "M2" -> true
      return cName.includes(bLevel) || bLevel.includes(cName);
    });
    
    // If we found matching books, return them. 
    // Otherwise, we return an empty array to strictly enforce filtering.
    // The dropdown rendering logic ensures the *currently selected book* is always visible.
    return matches;
  }, [books, className]);

  const bookFlow = useMemo(() => {
    // Structure: map[monthId][bookId] = { start, used, remaining }
    const stats: Record<string, Record<string, { start: number, used: number, remaining: number }>> = {};
    
    // Running remaining sessions from previous months
    // map[bookId] = number
    const runningRemaining: Record<string, number> = {};

    monthPlans.forEach(plan => {
      const dates = getDatesForMonth(plan.year, plan.month, selectedDays, holidays, specialDates);
      const calculatedUsages = calculateMonthUsage(dates, plan.allocations, classId);
      
      const planStats: Record<string, { start: number, used: number, remaining: number }> = {};
      
      plan.allocations.forEach(alloc => {
        const bookId = alloc.book_id;
        const book = books.find(b => b.id === bookId);
        // Fallback for total sessions if missing in data
        let defaultTotal = book?.total_sessions || 0;
        if (defaultTotal === 0 && book?.total_units) {
            // Estimate based on unit type
            const multiplier = book.unit_type === 'day' ? 1 : 2;
            defaultTotal = book.total_units * multiplier;
        }
        
        // 1. Determine Start (Total available for this month)
        let start = 0;
        
        // If user explicitly sets total override for this specific allocation (usually first month), use it.
        // BUT, if it's a subsequent month, we usually carry over.
        // Let's say: if total_sessions_override is present, it RESETS the flow (New Book Volume logic).
        if (alloc.total_sessions_override !== undefined) {
           start = alloc.total_sessions_override;
        } else {
           // Otherwise, take from previous remaining
           if (runningRemaining[bookId] !== undefined) {
              start = runningRemaining[bookId];
           } else {
              // First time seeing this book in the chain
              start = defaultTotal;
           }
        }
        
        // 2. Determine Used
        let used = 0;
        if (alloc.manual_used !== undefined) {
           used = alloc.manual_used;
        } else {
           used = calculatedUsages[bookId] || 0;
        }
        
        // 3. Determine Remaining
        const remaining = start - used;
        
        // Update state
        planStats[bookId] = { start, used, remaining };
        runningRemaining[bookId] = remaining;
      });
      
      stats[plan.id] = planStats;
    });
    
    return stats;
  }, [monthPlans, selectedDays, holidays, classId, books, specialDates]);

  // -- Handlers --

  const handleClassSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    const selectedClass = classes.find(c => c.id === cid);
    if (selectedClass) {
      setClassId(cid);
      setClassName(selectedClass.name);
      setYear(selectedClass.year);
      setSelectedDays(selectedClass.days || []);
      setStartTime(selectedClass.start_time);
      setEndTime(selectedClass.end_time);
    } else {
        setClassName('');
    }
  };

  const handleDayToggle = (day: Weekday) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleCopyPrevious = (currentMonthId: string) => {
    const currentIndex = monthPlans.findIndex(m => m.id === currentMonthId);
    if (currentIndex <= 0) return;
    
    const prevPlan = monthPlans[currentIndex - 1];
    
    setMonthPlans(monthPlans.map(plan => {
      if (plan.id !== currentMonthId) return plan;
      
      return {
        ...plan,
        allocations: prevPlan.allocations.map(a => ({
          ...a,
          id: Math.random().toString(),
          total_sessions_override: undefined,
          manual_used: undefined
        }))
      };
    }));
  };

  const toggleDateStatus = (dateStr: string) => {
     setSpecialDates(prev => {
        const current = prev[dateStr];
        const next = { ...prev };
        
        if (!current) {
           next[dateStr] = { type: 'event', name: 'Event' }; // Default to Event
        } else if (current.type === 'event') {
           next[dateStr] = { type: 'makeup', name: 'Makeup' };
        } else {
           delete next[dateStr];
        }
        return next;
     });
  };

  const updateAllocation = (monthId: string, allocId: string, field: keyof BookAllocation, value: any) => {
    setMonthPlans(monthPlans.map(plan => {
      if (plan.id !== monthId) return plan;
      return {
        ...plan,
        allocations: plan.allocations.map(a => {
          if (a.id !== allocId) return a;
          return { ...a, [field]: value };
        })
      };
    }));
  };

  const addAllocation = (monthId: string) => {
    setMonthPlans(monthPlans.map(plan => {
      if (plan.id !== monthId) return plan;
      return {
        ...plan,
        allocations: [
          ...plan.allocations,
          { 
            id: Math.random().toString(), 
            class_id: classId, 
            book_id: books[0]?.id || '', 
            sessions_per_week: 1, 
            priority: plan.allocations.length + 1 
          }
        ]
      };
    }));
  };
  
  const removeAllocation = (monthId: string, allocId: string) => {
    setMonthPlans(monthPlans.map(plan => {
      if (plan.id !== monthId) return plan;
      return {
        ...plan,
        allocations: plan.allocations.filter(a => a.id !== allocId)
      };
    }));
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

  const handleGenerate = (targetMonthId?: string) => {
    const classInfo: Class = {
      id: classId,
      name: className,
      year,
      level_group: 'Root',
      weekly_sessions: selectedDays.length,
      start_time: startTime,
      end_time: endTime,
      days: selectedDays
    };

    let allPlans: LessonPlan[] = [];
    let currentProgress: Record<string, { unit: number, day: number }> = {};

    monthPlans.forEach(plan => {
       const dates = getDatesForMonth(plan.year, plan.month, selectedDays, holidays);
       
       // Construct rules for this month (needed for distribution)
       // We assume rules are consistent with selectedDays
       const rules: ScheduleRule[] = selectedDays.map(d => ({
         id: Math.random().toString(),
         class_id: classId,
         weekday: d
       }));

       const result = generateLessonPlan(
         classInfo, 
         dates, 
         plan.allocations, 
         books, 
         rules, 
         currentProgress
       );
       
       allPlans = [...allPlans, ...result.plans];
       currentProgress = result.finalProgress;
    });

    if (targetMonthId) {
      const targetPlan = monthPlans.find(p => p.id === targetMonthId);
      if (targetPlan) {
        allPlans = allPlans.filter(l => {
          // Parse YYYY-MM-DD manually to avoid UTC conversion issues
          const [y, m, d] = l.date.split('-').map(Number);
          return (m - 1) === targetPlan.month && y === targetPlan.year;
        });
        
        // Auto-print logic for single month
        // We set the title temporarily for the filename
        const monthName = MONTH_NAMES[targetPlan.month];
        const fileName = `LessonPlan_${className}_${monthName}_${targetPlan.year}`;
        document.title = fileName;
        
        // Remove auto-print to allow user to view results first
        // setTimeout(() => {
        //     if (allPlans.length === 0) {
        //         alert('No lessons generated for this month. Please check if there are valid class days and books assigned.');
        //     } else {
        //         window.print();
        //     }
        //     // Reset title after print dialog closes (or timeout)
        //     setTimeout(() => document.title = 'Plan Generator', 1000);
        // }, 500);
      }
    } else {
        // Generate All
        document.title = `LessonPlan_${className}_All_Months_${year}`;
        setTimeout(() => document.title = 'Plan Generator', 2000);
    }

    setGeneratedPlan(allPlans);
    setIsGenerated(true);

    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };
  
  // Helper to calculate cumulative usage up to (and including) a specific month index
  const getCumulativeUsage = (monthIndex: number, bookId: string) => {
    // This is now legacy or can be adapted if needed, but we rely on bookFlow for UI.
    // However, the PDF generator might need cumulative logic?
    // Actually the PDF generator runs generateLessonPlan logic.
    // Let's keep this but maybe unused for now in the main table.
    return 0; 
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Guide Section */}
      {showGuide && (
        <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-2xl p-6 mb-8 shadow-sm relative overflow-hidden no-print">
          <div className="absolute top-0 right-0 p-4">
             <button onClick={() => setShowGuide(false)} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close Guide">
               <XCircle className="h-6 w-6" />
             </button>
          </div>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <HelpCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">레슨플랜만들기</h2>
              <p className="text-indigo-600 font-medium">아래 가이드를 읽고 제작해주세요</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-indigo-50 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex items-center gap-3 mb-3">
                 <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">1</div>
                 <h3 className="font-bold text-gray-800">기본 정보 입력</h3>
               </div>
               <p className="text-gray-600 text-sm leading-relaxed">
                 상단의 <strong>Class Name</strong>(반 이름)과 <strong>Schedule Days</strong>(수업 요일)를 선택해주세요. 자동으로 달력이 생성됩니다.
               </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-indigo-50 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex items-center gap-3 mb-3">
                 <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">2</div>
                 <h3 className="font-bold text-gray-800">교재 선택</h3>
               </div>
               <p className="text-gray-600 text-sm leading-relaxed">
                 월별 카드에서 <strong>Add Book</strong>을 눌러 교재를 추가하세요. 자동으로 진도가 계산되어 남은 횟수가 표시됩니다.
               </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-indigo-50 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex items-center gap-3 mb-3">
                 <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">3</div>
                 <h3 className="font-bold text-gray-800">생성 및 저장</h3>
               </div>
               <p className="text-gray-600 text-sm leading-relaxed">
                 하단의 <strong>Generate All</strong> 버튼을 누르면 전체 커리큘럼이 생성됩니다. PDF로 저장하여 바로 사용하세요.
               </p>
            </div>
          </div>
        </div>
      )}

      {/* Header / No Print */}
      <div className="no-print">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Plan Generator</h1>
          <p className="text-gray-500">Configure monthly curriculum and track remaining sessions.</p>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          {/* Top Settings Bar */}
          <div className="p-6 border-b border-gray-200 bg-gray-50 grid grid-cols-1 md:grid-cols-4 gap-6">
             <div>
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

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Academic Year</label>
                <div className="relative">
                  <select 
                    value={year} 
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 border bg-gray-50 appearance-none"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Schedule Days</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_WEEKDAYS.map(day => (
                    <button
                      key={day}
                      onClick={() => handleDayToggle(day)}
                      className={`
                        px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                        ${selectedDays.includes(day) 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}
                      `}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
          </div>

          {/* Monthly Plans List */}
          <div className="p-6 space-y-8 bg-gray-50/50">
            {monthPlans.map((plan, index) => (
              <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                   <div className="flex items-center gap-3">
                      <CalendarIcon className="h-5 w-5 text-indigo-600" />
                      <h3 className="font-bold text-gray-800 text-lg">
                        {MONTH_NAMES[plan.month]} {plan.year}
                      </h3>
                      <span className="text-xs font-medium px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                        {getDatesForMonth(plan.year, plan.month, selectedDays, holidays, specialDates).length} Sessions
                      </span>
                   </div>
                   <div className="flex items-center gap-2">
                     <button 
                        onClick={() => handleGenerate(plan.id)}
                        className="text-xs font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700 flex items-center gap-1 transition-colors shadow-sm"
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
                        onClick={() => addAllocation(plan.id)}
                        className="text-xs font-medium bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-100 flex items-center gap-1 transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Add Book
                      </button>
                      {/* Copy previous button if empty and not first */}
                      {index > 0 && plan.allocations.length === 0 && (
                          <button
                            onClick={() => handleCopyPrevious(plan.id)}
                            className="text-xs font-medium bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200 flex items-center gap-1 transition-colors"
                          >
                            <Copy className="h-3 w-3" /> Copy Previous
                          </button>
                      )}
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
                                const firstDay = new Date(year, month, 1).getDay();
                                const daysInMonth = new Date(year, month + 1, 0).getDate();
                                const days = [];
                                
                                // Empty slots for previous month
                                for (let i = 0; i < firstDay; i++) {
                                    days.push(<div key={`empty-${i}`} className="h-10"></div>);
                                }
                                
                                for (let d = 1; d <= daysInMonth; d++) {
                                    const dateObj = new Date(year, month, d);
                                    const dateStr = dateObj.toISOString().split('T')[0];
                                    const special = specialDates[dateStr];
                                    
                                    // Global Holiday Logic
                                    const globalHoliday = holidays.find(h => h.date === dateStr);
                                    // Check if this holiday applies to current class (empty = all, or included in list)
                                    const isRelevantHoliday = globalHoliday && 
                                        (!globalHoliday.affected_classes || globalHoliday.affected_classes.length === 0 || globalHoliday.affected_classes.includes(classId));
                                    
                                    // Determine status
                                    let statusClass = 'bg-white border-gray-200 text-gray-400';
                                    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()] as Weekday;
                                    const isRegularDay = selectedDays.includes(dayName);
                                    
                                    // Today check
                                    const todayStr = new Date().toISOString().split('T')[0];
                                    const isToday = dateStr === todayStr;

                                    if (special?.type === 'event') {
                                        statusClass = 'bg-red-100 border-red-200 text-red-700 font-bold';
                                    } else if (special?.type === 'makeup') {
                                        statusClass = 'bg-green-100 border-green-200 text-green-700 font-bold';
                                    } else if (isRelevantHoliday) {
                                        statusClass = 'bg-red-50 border-red-200 text-red-600 font-bold'; // Auto-holiday style
                                    } else if (isRegularDay) {
                                        statusClass = 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium';
                                    }

                                    if (isToday) {
                                        statusClass += ' ring-2 ring-offset-1 ring-indigo-500';
                                    }
                                    
                                    // Determine Title / Label
                                    let title = isRegularDay ? 'Class Day' : 'No Class';
                                    let label = null;
                                    
                                    if (special) {
                                        title = special.type.toUpperCase();
                                        label = special.type === 'event' ? 'X' : '+';
                                    } else if (isRelevantHoliday) {
                                        title = globalHoliday.name;
                                        label = 'H';
                                    }

                                    days.push(
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
                                }
                                return days;
                            })()}
                        </div>
                        <div className="mt-4 flex gap-4 text-xs text-gray-500 justify-center">
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-50 border border-indigo-200 rounded"></div> Class Day</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div> Event (No Class)</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div> Makeup (Extra Class)</div>
                        </div>
                    </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3 w-1/3">Book</th>
                        <th className="px-4 py-3 text-center">Weekly</th>
                        <th className="px-4 py-3 text-center">Order</th>
                        <th className="px-4 py-3 text-center text-gray-400">Total</th>
                        <th className="px-4 py-3 text-center text-indigo-600">Used</th>
                        <th className="px-4 py-3 text-center">Remaining</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {plan.allocations.map((alloc, index) => {
                         const book = books.find(b => b.id === alloc.book_id);
                         
                         const stats = bookFlow[plan.id]?.[alloc.book_id] || { start: 0, used: 0, remaining: 0 };
                         const { start, used, remaining } = stats;
                         const calculatedUsed = calculateMonthUsage(getDatesForMonth(plan.year, plan.month, selectedDays, holidays), plan.allocations, classId)[alloc.book_id] || 0;
                         
                         // Color Logic
                         let remainingColor = 'text-green-600 font-bold';
                         let StatusIcon = CheckCircle;
                         
                         // Calculate percentage based on the START value of this month (or original total? user wants flow)
                         // If we use Start as the denominator, it shows progress for THIS month's chunk?
                         // Or should we compare against Book Total?
                         // "Remaining acts like Next Month's Total" -> So remaining is the absolute number left.
                         // Color logic: if remaining < 0 -> Red.
                         
                         if (remaining < 0) {
                            remainingColor = 'text-red-600 font-black';
                            StatusIcon = XCircle;
                         } else if (remaining <= 4) { // Warning if less than 2 weeks approx
                            remainingColor = 'text-red-500 font-bold';
                            StatusIcon = AlertCircle;
                         } else if (remaining <= 8) {
                            remainingColor = 'text-yellow-600 font-bold';
                            StatusIcon = AlertCircle;
                         }

                         return (
                          <tr key={alloc.id} className="group hover:bg-gray-50">
                            <td className="px-6 py-3">
                              <select 
                                value={alloc.book_id}
                                onChange={(e) => updateAllocation(plan.id, alloc.id, 'book_id', e.target.value)}
                                className="block w-full rounded border-gray-200 text-sm p-1.5 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                {(() => {
                                  // Use filtered books, but ensure current book is included
                                  let displayBooks = filteredBooks;
                                  const currentBook = books.find(b => b.id === alloc.book_id);
                                  if (currentBook && !displayBooks.find(b => b.id === currentBook.id)) {
                                     displayBooks = [...displayBooks, currentBook];
                                  }

                                  const groupedBooks: Record<string, Book[]> = {};
                                  displayBooks.forEach(b => {
                                    const level = b.level || 'Others';
                                    if (!groupedBooks[level]) groupedBooks[level] = [];
                                    groupedBooks[level].push(b);
                                  });
                                  
                                  // Sort levels (custom order or alphabetical)
                                  const sortedLevels = Object.keys(groupedBooks).sort();
                                  
                                  return sortedLevels.map(level => (
                                    <optgroup key={level} label={level}>
                                      {groupedBooks[level].map(b => (
                                        <option key={b.id} value={b.id}>
                                          {b.name} ({b.category ? b.category.replace('c_', '').toUpperCase() : 'General'})
                                        </option>
                                      ))}
                                    </optgroup>
                                  ));
                                })()}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="number" min="1"
                                value={alloc.sessions_per_week}
                                onChange={(e) => updateAllocation(plan.id, alloc.id, 'sessions_per_week', parseInt(e.target.value))}
                                className="w-16 text-center rounded border-gray-200 p-1.5 text-sm"
                              />
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
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {index === 0 && (
                                    <input 
                                        type="number" min="0"
                                        value={alloc.total_sessions_override !== undefined ? alloc.total_sessions_override : ''}
                                        placeholder={book?.total_sessions?.toString()}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                                            updateAllocation(plan.id, alloc.id, 'total_sessions_override', val);
                                        }}
                                        className="w-16 text-center rounded border-gray-200 p-1.5 text-sm bg-gray-50 focus:bg-white"
                                    />
                                )}
                                {index > 0 && (
                                    <span className="text-gray-500 font-mono text-sm">{start}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-medium">
                               <input 
                                type="number" min="0"
                                value={alloc.manual_used !== undefined ? alloc.manual_used : calculatedUsed}
                                placeholder={calculatedUsed.toString()}
                                onChange={(e) => {
                                    // If user clears input, go back to calculated? or 0?
                                    // If they type a number, it overrides.
                                    // If empty, let's treat as undefined (revert to auto).
                                    const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                                    updateAllocation(plan.id, alloc.id, 'manual_used', val);
                                }}
                                className={`w-16 text-center rounded border-gray-200 p-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500 ${
                                    alloc.manual_used !== undefined ? 'bg-yellow-50 text-yellow-700 font-bold' : 'bg-white text-indigo-600'
                                }`}
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                               <div className={`flex items-center justify-center gap-1.5 ${remainingColor}`}>
                                  {remaining}
                               </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button 
                                onClick={() => removeAllocation(plan.id, alloc.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
                    <span>Generate All: 전체 월 데이터 생성</span>
                </div>
                <div className="flex items-center gap-1">
                    <Download className="h-4 w-4 text-gray-600" />
                    <span>Download PDF: 현재 화면 저장</span>
                </div>
            </div>
            <button
              onClick={() => handleGenerate()}
              disabled={monthPlans.every(p => p.allocations.length === 0)}
              title={monthPlans.every(p => p.allocations.length === 0) ? "교재를 먼저 추가해주세요" : "전체 커리큘럼 생성"}
              className={`flex items-center gap-2 px-8 py-3 rounded-full font-medium shadow-md transition-all text-lg
                ${monthPlans.every(p => p.allocations.length === 0) 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg active:scale-95'}
              `}
            >
              <Play className="h-5 w-5 fill-current" />
              Generate All
            </button>
          </div>
        </div>
      </div>

      {/* Output / Printable Area */}
      {isGenerated && (
        <div id="results" className="mt-12 bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200 scroll-mt-8">
          <div className="p-8 border-b border-gray-200 flex justify-between items-center bg-gray-50 no-print">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {generatedPlan.length > 0 && 
                 Object.keys(generatedPlan.reduce((acc, l) => ({...acc, [`${new Date(l.date).getMonth()}`]: true}), {})).length === 1 
                 ? `Generated Schedule - ${MONTH_NAMES[new Date(generatedPlan[0].date).getMonth()]} ${new Date(generatedPlan[0].date).getFullYear()}`
                 : "Generated Schedule (All Months)"}
              </h2>
              <p className="text-sm text-gray-500">{generatedPlan.length} sessions scheduled</p>
            </div>
            <button 
              onClick={() => {
                  const fileName = `LessonPlan_${className}_${generatedPlan.length > 0 ? 'Allocated' : 'Empty'}`;
                  document.title = fileName;
                  window.print();
                  setTimeout(() => document.title = 'Plan Generator', 1000);
              }}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>

          <div className="p-8">
            {generatedPlan.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <p className="text-lg font-medium mb-2">No lessons generated.</p>
                    <p className="text-sm">Please check if you have assigned books and selected valid schedule days.</p>
                </div>
            ) : (
                /* Group by Month for Display */
                Object.entries(generatedPlan.reduce((groups, lesson) => {
              const d = new Date(lesson.date);
              const key = `${d.getFullYear()}-${d.getMonth()}`;
              if (!groups[key]) groups[key] = [];
              groups[key].push(lesson);
              return groups;
            }, {} as Record<string, LessonPlan[]>)).map(([key, lessons], index, array) => {
              const [y, m] = key.split('-').map(Number);
              
              return (
                <div key={key} className={index < array.length - 1 ? "mb-12 print:break-after-page" : ""} style={index < array.length - 1 ? { pageBreakAfter: 'always' } : {}}>
                   <div className="mb-6 text-center">
                      <h1 className="text-2xl font-bold text-gray-900 mb-1">{className} - {MONTH_NAMES[m]} {y}</h1>
                      <p className="text-gray-500 text-sm">Monthly Lesson Plan</p>
                   </div>

                   <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border border-gray-200 rounded-lg overflow-hidden">
                      <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2 font-semibold border-r">Date</th>
                          <th className="px-4 py-2 font-semibold border-r">Day</th>
                          <th className="px-4 py-2 font-semibold border-r">Book</th>
                          <th className="px-4 py-2 font-semibold border-r">Content</th>
                          <th className="px-4 py-2 font-semibold text-right">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lessons.map((lesson) => (
                          <tr key={lesson.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap border-r">
                              {new Date(lesson.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-gray-500 border-r">
                              {new Date(lesson.date).toLocaleDateString('en-US', { weekday: 'short' })}
                            </td>
                            <td className="px-4 py-3 text-gray-700 font-medium border-r">
                              {books.find(b => b.id === lesson.book_id)?.name}
                            </td>
                            <td className="px-4 py-3 text-gray-600 border-r">
                              {lesson.content}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500 font-mono">
                              {lesson.unit_text}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}
    </div>
  );
}