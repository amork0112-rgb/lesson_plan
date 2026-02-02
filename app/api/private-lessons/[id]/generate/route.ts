import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';
import { generateLessons, getDaysPerUnit } from '@/lib/lessonEngine';
import { addDays, format, getDay, parseISO, startOfDay } from 'date-fns';
import { Book, Weekday } from '@/types';

export const dynamic = 'force-dynamic';

const WEEKDAY_MAP: Record<string, number> = {
  'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
};

// Reverse map for checking schedule keys
const INT_TO_WEEKDAY: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { book_id, limit } = body; // limit e.g. 5, 10
    
    if (!book_id || !limit) {
      return NextResponse.json({ error: 'Missing book_id or limit' }, { status: 400 });
    }

    const supabase = getSupabaseService();

    // 1. Fetch Private Lesson
    const { data: privateLesson, error: plError } = await supabase
      .from('private_lessons')
      .select('*, private_lesson_schedules(*)')
      .eq('id', id)
      .single();

    if (plError || !privateLesson) {
      return NextResponse.json({ error: 'Private Lesson not found' }, { status: 404 });
    }

    // 2. Fetch Book
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', book_id)
      .single();

    if (bookError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // 3. Determine Start Date
    // Check if any lessons exist for this private lesson + book
    // Actually, we should check *any* lesson for this private lesson to determine date sequence?
    // Or just for this book? Usually private lessons follow a schedule regardless of book.
    // So we find the LAST lesson date for this owner_id.
    
    const { data: lastLesson } = await supabase
      .from('lesson_plans')
      .select('date, unit_no, day_no, book_id')
      .eq('owner_id', id)
      .eq('owner_type', 'private')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Also fetch last lesson SPECIFIC to this book for progress tracking
    const { data: lastBookLesson } = await supabase
      .from('lesson_plans')
      .select('unit_no, day_no')
      .eq('owner_id', id)
      .eq('owner_type', 'private')
      .eq('book_id', book_id)
      .order('date', { ascending: false }) // primary sort
      .order('display_order', { ascending: false }) // secondary sort
      .limit(1)
      .maybeSingle();

    let startDate: Date;
    if (lastLesson) {
      startDate = addDays(parseISO(lastLesson.date), 1);
    } else {
      startDate = privateLesson.start_date ? parseISO(privateLesson.start_date) : new Date();
    }
    startDate = startOfDay(startDate);

    // 4. Calculate Target Dates (The "Chunk")
    let scheduledDays: string[] = [];
    
    if (privateLesson.private_lesson_schedules && privateLesson.private_lesson_schedules.length > 0) {
        // Map integer days to strings (Mon, Tue, etc.)
        scheduledDays = privateLesson.private_lesson_schedules
            .map((s: any) => INT_TO_WEEKDAY[s.day_of_week])
            .filter(Boolean);
    } else {
        // Fallback to legacy JSON
        const schedule = privateLesson.schedule || {}; 
        scheduledDays = Object.keys(schedule); 
    }
    
    if (scheduledDays.length === 0) {
      return NextResponse.json({ error: 'No schedule defined for private lesson' }, { status: 400 });
    }

    const targetDates: string[] = [];
    let currentDate = startDate;
    let loops = 0;
    
    while (targetDates.length < limit && loops < 365) { // Safety break
      const dayName = INT_TO_WEEKDAY[getDay(currentDate)];
      if (scheduledDays.includes(dayName)) {
        targetDates.push(format(currentDate, 'yyyy-MM-dd'));
      }
      currentDate = addDays(currentDate, 1);
      loops++;
    }

    if (targetDates.length === 0) {
       return NextResponse.json({ error: 'Could not find valid dates based on schedule' }, { status: 400 });
    }

    // 5. Calculate Initial Progress
    let initialProgress: { unit: number, day: number } = { unit: 1, day: 1 };
    
    if (lastBookLesson) {
       const dpu = getDaysPerUnit(book);
       let u = lastBookLesson.unit_no || 1;
       let d = lastBookLesson.day_no || 1;
       
       if (d < dpu) {
         d++;
       } else {
         u++;
         d = 1;
       }
       initialProgress = { unit: u, day: d };
    }

    // 6. Call Generator
    // We construct a dummy "Plan" to feed the engine
    const planId = `chunk-${Date.now()}`;
    const monthPlans = [{
      id: planId,
      year: parseInt(format(new Date(), 'yyyy')), // Irrelevant for private chunk
      month: parseInt(format(new Date(), 'MM')), // Irrelevant
      allocations: [{ book_id: book.id, sessions: limit }]
    }];

    const planDates = {
      [planId]: targetDates
    };

    const generated = generateLessons({
      ownerId: id,
      ownerType: 'private',
      monthPlans,
      planDates,
      selectedDays: scheduledDays, // Used for slotsPerDay calc, assumes standard logic
      books: [book],
      initialProgress: { [book.id]: initialProgress },
      initialSlotsUsed: {} // Assume empty slots for these new dates
    });

    // 7. Save to DB
    if (generated.length > 0) {
        const payload = generated.map(l => ({
            owner_type: 'private',
            owner_id: id,
            class_id: privateLesson.class_id || null,
            date: l.date,
            period: l.period || 1,
            book_id: l.book_id,
            content: l.content,
            display_order: l.display_order,
            unit_no: l.unit_no,
            day_no: l.day_no
        }));

        const { error: insertError } = await supabase
            .from('lesson_plans')
            .insert(payload);
            
        if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true, count: generated.length, generated });

  } catch (e: any) {
    console.error('Private Gen Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
