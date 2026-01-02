import { LessonPlan, BookAllocation, Book } from '@/types';
import { getSlotsPerDay, SCP_PERIOD } from './constants';

interface GenerateLessonInput {
  classId: string;
  monthPlans: {
    id: string;
    year: number;
    month: number;
    allocations: BookAllocation[];
  }[];
  planDates: Record<string, string[]>;
  selectedDays: string[];
  books: Book[];
  scpType?: string | null;
}

function getDaysPerUnit(book?: Book) {
  if (!book) return 3;
  if (book.days_per_unit && book.days_per_unit > 0) return book.days_per_unit;
  if (book.unit_type === 'day') return 1;
  return 3;
}

export function generateLessons(input: GenerateLessonInput): LessonPlan[] {
  const { classId, monthPlans, planDates, selectedDays, books, scpType } = input;
  const slotsPerDay = getSlotsPerDay(selectedDays);
  let displayOrder = 1;
  let scpDay = 1;

  const lessons: LessonPlan[] = [];

  monthPlans.forEach(plan => {
    const dates = planDates[plan.id] || [];
    const allocations = [...plan.allocations].sort((a, b) => a.priority - b.priority);

    const progress: Record<string, { unit: number; day: number }> = {};
    allocations.forEach(a => (progress[a.book_id] = { unit: 1, day: 1 }));

    let rrIndex = 0;

    dates.forEach(date => {
      const usedToday = new Set<string>();

      for (let period = 1; period <= slotsPerDay; period++) {
        if (allocations.length === 0) break;

        let picked: BookAllocation | null = null;
        for (let i = 0; i < allocations.length; i++) {
          const cand = allocations[(rrIndex + i) % allocations.length];
          if (!usedToday.has(cand.book_id)) {
            picked = cand;
            rrIndex = (rrIndex + i + 1) % allocations.length;
            break;
          }
        }

        if (!picked) break;

        const book = books.find(b => b.id === picked!.book_id);
        const dpu = getDaysPerUnit(book);
        const p = progress[picked!.book_id];

        lessons.push({
          id: `${date}_${picked!.book_id}_${period}`,
          class_id: classId,
          date,
          period,
          display_order: displayOrder++,
          is_makeup: false,
          book_id: picked!.book_id,
          book_name: book?.name || 'Unknown',
          content: `Unit ${p.unit} Day ${p.day}`
        });

        usedToday.add(picked!.book_id);

        if (p.day < dpu) {
          p.day++;
        } else {
          p.unit++;
          p.day = 1;
        }
      }

      if (scpType) {
        const cap = scpType.charAt(0).toUpperCase() + scpType.slice(1);
        lessons.push({
          id: `${date}_scp_${scpDay}`,
          class_id: classId,
          date,
          period: SCP_PERIOD,
          display_order: displayOrder++,
          is_makeup: false,
          book_id: `scp_${scpType}`,
          book_name: `SCP ${cap}`,
          content: `SCP ${cap} Day ${scpDay++}`
        });
      }
    });
  });

  return lessons;
}
