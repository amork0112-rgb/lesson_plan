// API Route: GET /api/private-lessons
// Description: Fetch all private lessons with associated schedules
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseService();
  const { data, error } = await supabase
    .from('private_lessons')
    .select('*, students(student_name, english_first_name), private_lesson_schedules(day_of_week, time), private_lesson_books(book_id)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform data to match frontend expectation (lesson.schedule as object)
  const result = data?.map(lesson => {
    const schedule: Record<string, string> = {};
    const DAY_MAP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    if (lesson.private_lesson_schedules) {
        lesson.private_lesson_schedules.forEach((s: any) => {
            if (s.day_of_week !== undefined && DAY_MAP[s.day_of_week]) {
                schedule[DAY_MAP[s.day_of_week]] = s.time;
            }
        });
    }

    // Map books
    const books = lesson.private_lesson_books?.map((b: any) => b.book_id) || [];
    // Include legacy book_id if not present
    if (lesson.book_id && !books.includes(lesson.book_id)) {
        books.push(lesson.book_id);
    }

    return {
      ...lesson,
      student_name: lesson.students?.student_name || lesson.student_name || 'Unknown',
      schedule, // Frontend expects this format for rendering
      book_ids: books,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = getSupabaseService();
    
    // Validation
    const { student_id, class_id, campus, schedules, ...lessonData } = body;

    if (student_id) {
        // Fetch student to validate
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('*')
            .eq('id', student_id)
            .single();
        
        if (studentError || !student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // Assertions
        if (class_id && student.main_class !== class_id) {
            return NextResponse.json({ error: 'Student does not belong to the selected class' }, { status: 400 });
        }
        
        if (campus && student.campus !== campus) {
             return NextResponse.json({ error: 'Student does not belong to the selected campus' }, { status: 400 });
        }
    }

    // Prepare Student Name
    let studentName = lessonData.student_name;
    
    if (!studentName && student_id) {
        const { data: student } = await supabase.from('students').select('student_name').eq('id', student_id).single();
        if (student) {
            studentName = student.student_name;
        }
    }

    // 1. Insert Private Lesson
    const lessonPayload = {
        student_id,
        // class_id, // Removed as column likely does not exist in private_lessons
        book_id: lessonData.book_id,
        start_date: lessonData.start_date,
        memo: lessonData.memo,
        campus: campus,
        // student_name: studentName, // Removed as column does not exist
    };

    const { data: lesson, error: lessonError } = await supabase
      .from('private_lessons')
      .insert([lessonPayload])
      .select()
      .single();

    if (lessonError) {
      return NextResponse.json({ error: lessonError.message }, { status: 500 });
    }

    // 2. Insert Schedules (Defensive Parsing)
    let scheduleArray: { day_of_week: number; time: string }[] = [];

    if (schedules && !Array.isArray(schedules)) {
        // Handle object format: { Mon: "14:00", Wed: "14:00" }
        const DAY_MAP: Record<string, number> = {
            Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
        };
        scheduleArray = Object.entries(schedules).map(([day, time]) => ({
            day_of_week: DAY_MAP[day],
            time: time as string,
        }));
    } else if (Array.isArray(schedules)) {
        // Handle array format
        scheduleArray = schedules;
    }

    if (scheduleArray.length > 0) {
        const scheduleRows = scheduleArray.map(s => ({
            private_lesson_id: lesson.id, // Correct column name
            day_of_week: s.day_of_week,
            time: s.time, // Correct column name
        }));

        const { error: scheduleError } = await supabase
            .from('private_lesson_schedules')
            .insert(scheduleRows);

        if (scheduleError) {
            console.error('Schedule insert error:', scheduleError);
            return NextResponse.json({ error: 'Lesson created but schedule failed: ' + scheduleError.message }, { status: 500 });
        }
    }

    // 3. Insert Books
    if (lessonData.book_ids && Array.isArray(lessonData.book_ids) && lessonData.book_ids.length > 0) {
         const bookRows = lessonData.book_ids.map((bid: string) => ({
             private_lesson_id: lesson.id,
             book_id: bid
         }));
         const { error: bookError } = await supabase.from('private_lesson_books').insert(bookRows);
         if (bookError) console.error('Book insert error:', bookError);
    } else if (lessonData.book_id) {
         // Legacy fallback if user sends single book_id
         const { error: bookError } = await supabase.from('private_lesson_books').insert({
             private_lesson_id: lesson.id,
             book_id: lessonData.book_id
         });
         if (bookError) console.error('Book insert error:', bookError);
    }

    return NextResponse.json(lesson);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
