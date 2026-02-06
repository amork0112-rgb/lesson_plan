export function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateKey(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function getWeekday(dateStr: string) {
  const d = parseLocalDate(dateStr);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

import { Weekday, SpecialDate } from '@/types';

export function getDatesForMonth(
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
