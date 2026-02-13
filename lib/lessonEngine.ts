import { LessonPlan, BookAllocation, Book } from '@/types';
import { getSlotsPerDay, SCP_PERIOD } from './constants';

export interface AllocationInput {
  book_id: string;
  sessions: number;
}

interface GenerateLessonInput {
  ownerId: string;
  ownerType: 'class' | 'private';
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
  initialSlotsUsed?: Record<string, number>;
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
  const { ownerId, ownerType, monthPlans, planDates, selectedDays, books, initialProgress, initialSlotsUsed } = input;
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

    // 1. Create the "Decks" of lessons
    // Normal books go to the normal deck (interleaved)
    // Homework books (SCP) go to a separate deck
    const normalDeck: { book_id: string }[] = [];
    const homeworkDeck: Record<string, { book_id: string }[]> = {}; // book_id -> array of sessions
    
    const normalAllocations = plan.allocations.filter(a => {
        const book = books.find(b => b.id === a.book_id);
        return book?.role !== 'homework' && !book?.name?.startsWith('SCP');
    });
    
    const homeworkAllocations = plan.allocations.filter(a => {
        const book = books.find(b => b.id === a.book_id);
        return book?.role === 'homework' || book?.name?.startsWith('SCP');
    });

    // Fill Normal Deck (Interleaved)
    const tempNormal = normalAllocations.map(a => ({ 
        book_id: a.book_id, 
        remaining: a.sessions 
    }));

    let hasMoreNormal = true;
    while (hasMoreNormal) {
        hasMoreNormal = false;
        for (const alloc of tempNormal) {
            if (alloc.remaining > 0) {
                normalDeck.push({ book_id: alloc.book_id });
                alloc.remaining--;
                hasMoreNormal = true;
            }
        }
    }

    // Fill Homework Deck (Queue per book)
    homeworkAllocations.forEach(a => {
        homeworkDeck[a.book_id] = Array(a.sessions).fill({ book_id: a.book_id });
    });

    // 2. Initialize progress for any new books
    plan.allocations.forEach(a => {
      if (!globalProgress[a.book_id]) {
        globalProgress[a.book_id] = { unit: 1, day: 1 };
      }
    });

    // 3. Distribute Decks into Slots
    let normalDeckIndex = 0;
    const slotsUsedPerDate: Record<string, number> = initialSlotsUsed ? { ...initialSlotsUsed } : {};

    dates.forEach(date => {
        const currentSlotBase = slotsUsedPerDate[date] || 0;
        const availableNormalSlots = Math.max(0, slotsPerDay - currentSlotBase);

        // A. Fill Normal Slots (1 to slotsPerDay)
        for (let i = 1; i <= availableNormalSlots; i++) {
            if (normalDeckIndex >= normalDeck.length) break;

            const period = currentSlotBase + i;
            const item = normalDeck[normalDeckIndex++];
            addLesson(date, period, item.book_id);
        }

        // B. Fill Homework Slot (Always at slotsPerDay + 1)
        // Only if there are homework sessions remaining for this month
        Object.keys(homeworkDeck).forEach(bookId => {
            if (homeworkDeck[bookId].length > 0) {
                const item = homeworkDeck[bookId].shift()!;
                const period = slotsPerDay + 1; // SCP slot is always +1 of normal slots
                addLesson(date, period, item.book_id);
            }
        });

        slotsUsedPerDate[date] = currentSlotBase + slotsPerDay;
    });

    // Helper to add lesson and advance progress
    function addLesson(date: string, period: number, bookId: string) {
        const book = books.find(b => b.id === bookId);
        if (!book) return;

        const prog = globalProgress[bookId];
        const isTrophy = (book.series === 'Trophy 9') || /trop\w+\s*9/i.test(book.name) || book.progression_type === 'volume-day';
        const levelTag = isTrophy ? (book.series_level || (book.name.match(/trop\w+\s*9\s*([0-9A-Za-z]+)/i)?.[1] || (book.level || 'T9'))) : undefined;
        const isEvent = book.unit_type === 'event';

        lessons.push({
          id: `${date}_${bookId}_${period}_${Math.random().toString(36).substr(2, 5)}`,
          owner_type: ownerType,
          owner_id: ownerId,
          class_id: ownerType === 'class' ? ownerId : undefined,
          date,
          period,
          display_order: displayOrder++,
          is_makeup: false,
          book_id: bookId,
          book_name: book.name,
          content: isEvent ? 'Event' : (isTrophy ? `${levelTag}-${prog.unit} Day ${prog.day}` : `Unit ${prog.unit} Day ${prog.day}`),
          unit_no: prog.unit,
          day_no: prog.day
        });

        if (!isEvent) {
            const dpu = getDaysPerUnit(book);
            if (globalProgress[bookId].day < dpu) {
                globalProgress[bookId].day++;
            } else {
                globalProgress[bookId].unit++;
                globalProgress[bookId].day = 1;
            }
        }
    }
  });

  return lessons;
}

