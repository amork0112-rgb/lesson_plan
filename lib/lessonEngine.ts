import { LessonPlan, BookAllocation, Book } from '@/types';
import { getSlotsPerDay, SCP_PERIOD, SYSTEM_EVENT_ID } from './constants';

export interface AllocationInput {
  book_id: string;
  sessions: number;
}

interface GenerateLessonInput {
  classId: string;
  monthPlans: {
    id: string;
    year: number;
    month: number;
    // We now expect explicit session counts
    allocations: AllocationInput[];
  }[];
  planDates: Record<string, string[]>;
  selectedDays: string[];
  books: Book[];
  scpType?: string | null;
  initialProgress?: Record<string, { unit: number; day: number }>;
}

export function getDaysPerUnit(book?: Book) {
  if (!book) return 3;
  const isTrophy = (book.series === 'Trophy 9') || /trop\w+\s*9/i.test(book.name) || book.progression_type === 'volume-day';
  if (isTrophy) {
    if (book.days_per_volume && book.days_per_volume > 0) return book.days_per_volume;
    return 4;
  }
  if (book.days_per_unit && book.days_per_unit > 0) return book.days_per_unit;
  if (book.unit_type === 'day') return 1;
  return 3;
}

export function generateLessons(input: GenerateLessonInput): LessonPlan[] {
  const { classId, monthPlans, planDates, selectedDays, books, initialProgress } = input;
  if (!Array.isArray(books) || books.length === 0) return [];
  const slotsPerDay = getSlotsPerDay(selectedDays);
  let displayOrder = 1;

  const lessons: LessonPlan[] = [];
  const globalProgress: Record<string, { unit: number; day: number }> = initialProgress ? { ...initialProgress } : {};

  // Sort plans chronologically
  const sortedPlans = [...monthPlans].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  sortedPlans.forEach(plan => {
    if (!plan || !Array.isArray(plan.allocations) || plan.allocations.length === 0) return;
    const dates = planDates[plan.id];
    if (!Array.isArray(dates) || dates.length === 0) return;

    // 1. Create the "Deck" of lessons to be distributed
    // We use a Round-Robin (Interleaved) approach to maximize daily variety
    // Instead of [A, A, A, B, B, B], we generate [A, B, A, B, A, B]
    const deck: { book_id: string }[] = [];
    
    // Create a mutable copy of allocations to track remaining sessions
    const tempAllocations = plan.allocations.map(a => ({ 
        book_id: a.book_id, 
        remaining: a.sessions 
    }));

    let hasMore = true;
    while (hasMore) {
        hasMore = false;
        for (const alloc of tempAllocations) {
            if (alloc.remaining > 0) {
                deck.push({ book_id: alloc.book_id });
                alloc.remaining--;
                hasMore = true;
            }
        }
    }

    // 2. Initialize progress for any new books
    plan.allocations.forEach(a => {
      if (!globalProgress[a.book_id]) {
        globalProgress[a.book_id] = { unit: 1, day: 1 };
      }
    });

    // 3. Distribute Deck into Slots
    // Slots are determined by Dates * SlotsPerDay
    // We fill sequentially: Date 1 (Slot 1, Slot 2...), Date 2...
    
    let deckIndex = 0;

    dates.forEach(date => {
        // For each date, we have `slotsPerDay` slots
        for (let period = 1; period <= slotsPerDay; period++) {
            if (deckIndex >= deck.length) break; // Run out of allocated sessions

            const item = deck[deckIndex++];
            const book = books.find(b => b.id === item.book_id);
            
            if (!book) continue; // Should not happen if data is consistent

            const p = globalProgress[item.book_id];
            const isTrophy = (book.series === 'Trophy 9') || /trop\w+\s*9/i.test(book.name) || book.progression_type === 'volume-day';
            const levelTag = isTrophy ? (book.series_level || (book.name.match(/trop\w+\s*9\s*([0-9A-Za-z]+)/i)?.[1] || (book.level || 'T9'))) : undefined;
            const isEvent = book.id === 'system_event' || book.id === SYSTEM_EVENT_ID || book.unit_type === 'event';

            lessons.push({
              id: `${date}_${item.book_id}_${period}_${Math.random().toString(36).substr(2, 5)}`, // Ensure unique ID
              class_id: classId,
              date,
              period,
              display_order: displayOrder++,
              is_makeup: false,
              book_id: item.book_id,
              book_name: book.name,
              content: isEvent ? 'Event' : (isTrophy ? `${levelTag}-${p.unit} Day ${p.day}` : `Unit ${p.unit} Day ${p.day}`),
              unit_no: p.unit,
              day_no: p.day
            });

            // Advance Progress
            if (!isEvent) {
                const dpu = getDaysPerUnit(book);
                if (globalProgress[item.book_id].day < dpu) {
                    globalProgress[item.book_id].day++;
                } else {
                    globalProgress[item.book_id].unit++;
                    globalProgress[item.book_id].day = 1;
                }
            }
        }
    });
  });

  return lessons;
}

