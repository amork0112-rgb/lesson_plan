import { 
  Class, ScheduleRule, Holiday, Book, BookAllocation, LessonPlan, Weekday, LessonUnit, SpecialDate 
} from '@/types';
import { parseLocalDate } from './date';

const WEEKDAYS: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper to check if a date string is in a holiday list
const isHoliday = (dateStr: string, holidays: Holiday[]): boolean => {
  return holidays.some(h => h.date === dateStr);
};

export function generateBookUnits(book: Book): LessonUnit[] {
  // If units are already defined, return them sorted
  if (book.units && book.units.length > 0) {
    return [...book.units].sort((a, b) => a.sequence - b.sequence);
  }

  // Otherwise, generate them based on total_units and unit_type
  const units: LessonUnit[] = [];
  let sequence = 1;

  const isTrophy = (book.series === 'Trophy 9') || /trop\w+\s*9/i.test(book.name);
  if (isTrophy || book.progression_type === 'volume-day') {
    const volumes = book.volume_count && book.volume_count > 0 ? book.volume_count : 4;
    const daysPerVol = book.days_per_volume && book.days_per_volume > 0 ? book.days_per_volume : 4;
    const levelTag = book.series_level || (book.name.match(/trop\w+\s*9\s*([0-9A-Za-z]+)/i)?.[1] || (book.level || 'T9'));
    for (let v = 1; v <= volumes; v++) {
      for (let d = 1; d <= daysPerVol; d++) {
        units.push({
          id: `gen_${book.id}_v${v}_d${d}`,
          book_id: book.id,
          sequence: sequence++,
          unit_no: v,
          day_no: d,
          type: 'lesson',
          title: `${levelTag}-${v} Day ${d}`
        });
      }
    }
    if (book.review_units) {
      for (let r = 1; r <= Math.floor(volumes / (book.review_units || volumes)); r++) {
        units.push({
          id: `gen_${book.id}_rev_${r}`,
          book_id: book.id,
          sequence: sequence++,
          type: 'review',
          title: `Review ${r}`
        });
      }
    }
    return units;
  }

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

 
