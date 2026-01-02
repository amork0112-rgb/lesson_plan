import { 
  Class, ScheduleRule, Holiday, Event, Book, BookAllocation, LessonPlan, Weekday, LessonUnit, SpecialDate 
} from '@/types';

const WEEKDAYS: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper to check if a date string is in a holiday list
const isHoliday = (dateStr: string, holidays: Holiday[]): boolean => {
  return holidays.some(h => h.date === dateStr);
};

// Helper to check if a date is in an event range
const isEvent = (dateStr: string, events: Event[]): boolean => {
  return events.some(e => dateStr >= e.start_date && dateStr <= e.end_date);
};

export function generateBookUnits(book: Book): LessonUnit[] {
  // If units are already defined, return them sorted
  if (book.units && book.units.length > 0) {
    return [...book.units].sort((a, b) => a.sequence - b.sequence);
  }

  // Otherwise, generate them based on total_units and unit_type
  const units: LessonUnit[] = [];
  let sequence = 1;

  for (let u = 1; u <= book.total_units; u++) {
    // Determine number of days per unit based on unit_type or explicit days_per_unit
    let daysPerUnit = 1;
    if (book.days_per_unit) {
      daysPerUnit = book.days_per_unit;
    } else if (book.unit_type === 'day') {
      daysPerUnit = 1;
    } else {
        daysPerUnit = book.total_sessions ? Math.floor(book.total_sessions / book.total_units) : 2;
    }

    // Add Lesson Days
    for (let d = 1; d <= daysPerUnit; d++) {
      units.push({
        id: `gen_${book.id}_u${u}_d${d}`,
        book_id: book.id,
        sequence: sequence++,
        unit_no: u,
        day_no: d,
        type: 'lesson',
        title: book.unit_type === 'day' ? `Day ${u}` : `Unit ${u} - Day ${d}`
      });
    }

    // Add Review if needed
    // User logic: "Review 1"
    // When do reviews happen? `review_units` usually says "Every N units".
    if (book.review_units && u % book.review_units === 0) {
      units.push({
        id: `gen_${book.id}_rev_${u}`,
        book_id: book.id,
        sequence: sequence++,
        type: 'review',
        title: `Review ${u / book.review_units}`
      });
    }
  }

  return units;
}

export interface AnnualPlanRow {
  class_id: string;
  book_id: string;
  section: string;
  total_sessions_year: number;
  monthly_distribution: Record<number, number>;
}

export interface MonthAllocation {
  book_id: string;
  section: string;
  required_sessions: number;
  priority: number;
}

export interface MonthPlan {
  year: number;
  month: number;
  allocations: MonthAllocation[];
}

export function buildMonthPlansFromAnnual(
  annualRows: AnnualPlanRow[],
  startYear: number
): MonthPlan[] {
  const months = [3,4,5,6,7,8,9,10,11,12,1,2];
  const monthPlans: MonthPlan[] = [];

  months.forEach((m) => {
    const year = m >= 3 ? startYear : startYear + 1;
    const allocations: MonthAllocation[] = [];

    let priorityCounter = 1;
    let totalSessions = 0;

    annualRows.forEach(row => {
      const count = row.monthly_distribution[m] || 0;
      if (count > 0) {
        allocations.push({
          book_id: row.book_id,
          section: row.section,
          required_sessions: count,
          priority: priorityCounter++
        });
        totalSessions += count;
      }
    });

    if (totalSessions !== 24) {
      console.warn(`[WARN] ${year}-${m} total sessions = ${totalSessions} (should be 24)`);
    }

    monthPlans.push({
      year,
      month: m - 1,
      allocations
    });
  });

  return monthPlans;
}
export function generateClassDates(
  year: number,
  rules: ScheduleRule[],
  holidays: Holiday[],
  events: Event[]
): string[] {
  const dates: string[] = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  
  // Create a set of allowed weekdays for O(1) lookup
  const allowedDays = new Set(rules.map(r => r.weekday));

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayName = WEEKDAYS[d.getDay()];
    // Use local date string for consistency
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (allowedDays.has(dayName)) {
      if (!isHoliday(dateStr, holidays) && !isEvent(dateStr, events)) {
        dates.push(dateStr);
      }
    }
  }
  return dates;
}

export function calculateBookDistribution(
  allocations: BookAllocation[],
  rules: ScheduleRule[]
): Record<string, string> {
  const sortedRules = [...rules].sort((a, b) => {
    return WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday);
  });

  const slots: (string | null)[] = new Array(sortedRules.length).fill(null);
  
  const sortedAllocations = [...allocations].sort((a, b) => a.priority - b.priority);

  let currentSlot = 0;
  
  for (const alloc of sortedAllocations) {
    for (let i = 0; i < alloc.sessions_per_week; i++) {
      if (currentSlot < slots.length) {
        slots[currentSlot] = alloc.book_id;
        currentSlot++;
      }
    }
  }

  const weekdayToBook: Record<string, string> = {};
  sortedRules.forEach((rule, idx) => {
    if (slots[idx]) {
      weekdayToBook[rule.weekday] = slots[idx]!;
    }
  });
  
  return weekdayToBook;
}

export function generateLessonPlan(
  classInfo: Class,
  dates: string[],
  allocations: BookAllocation[],
  books: Book[],
  rules: ScheduleRule[],
  initialProgress?: Record<string, { unit: number, day: number }>,
  specialDates?: Record<string, SpecialDate>
): { plans: LessonPlan[], finalProgress: Record<string, { unit: number, day: number }> } {
  // Use shared distribution logic
  const weekdayToBook = calculateBookDistribution(allocations, rules);

  // 3. Generate Plan
  const plans: LessonPlan[] = [];
  const bookProgress: Record<string, { unit: number, day: number }> = initialProgress ? { ...initialProgress } : {};
  
  // Initialize progress for new books if not in initialProgress
  books.forEach(b => {
    if (!bookProgress[b.id]) {
      bookProgress[b.id] = { unit: 1, day: 1 };
    }
  });

  dates.forEach((dateStr) => {
    // Check for special dates (School Events)
    const special = specialDates ? specialDates[dateStr] : undefined;
    if (special && special.type === 'school_event') {
        plans.push({
            id: Math.random().toString(36).substr(2, 9),
            class_id: classInfo.id,
            date: dateStr,
            book_id: 'event',
            unit_id: 'event',
            display_order: 1,
            is_makeup: false,
            unit_text: special.name,
            book_name: 'School Event'
        });
        return; // Skip book assignment for this date
    }

    const dateObj = new Date(dateStr);
    const dayName = WEEKDAYS[dateObj.getDay()];
    const bookId = weekdayToBook[dayName];

    if (bookId) {
      const book = books.find(b => b.id === bookId);
      if (book) {
        const progress = bookProgress[bookId];
        
        // Create Plan Item
        const plan: LessonPlan = {
          id: Math.random().toString(36).substr(2, 9),
          class_id: classInfo.id,
          date: dateStr,
          book_id: book.id,
          unit_id: `u_${progress.unit}`, // Mock ID
          display_order: 1,
          is_makeup: false,
          unit_text: `${book.unit_type === 'unit' ? 'Unit' : 'Day'} ${progress.unit}`,
          book_name: book.name
        };
        plans.push(plan);

        // Increment Progress
        let daysPerUnit = 1;
        if (book.days_per_unit) {
            daysPerUnit = book.days_per_unit;
        } else if (book.unit_type === 'day') {
            daysPerUnit = 1;
        } else {
            daysPerUnit = book.total_sessions ? Math.floor(book.total_sessions / book.total_units) : 1;
        }

        if (progress.day < daysPerUnit) {
            progress.day++;
        } else {
            progress.unit++;
            progress.day = 1;
        }
      }
    }
  });

  return { plans, finalProgress: bookProgress };
}
