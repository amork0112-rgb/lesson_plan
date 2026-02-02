import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseService();
  const { data, error } = await supabase
    .from('private_lessons')
    .select('*, private_lesson_schedules(*)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = getSupabaseService();
    
    // Validation
    const { student_id, class_id, campus, schedules, ...lessonData } = body;
    const campus_id = campus; // Alias for consistency if needed, or just use campus

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
        if (class_id && student.class_id !== class_id) {
            return NextResponse.json({ error: 'Student does not belong to the selected class' }, { status: 400 });
        }
        
        // Note: student table uses 'campus' column
        if (campus && student.campus !== campus) {
             return NextResponse.json({ error: 'Student does not belong to the selected campus' }, { status: 400 });
        }
    }

    // 1. Insert Private Lesson
    // We exclude 'schedules', 'class_id' (if not in table), 'campus_id' (if needed)
    // The lessonData should contain: student_name, student_id, book_id, start_date, memo, status, campus (if used)
    
    // Ensure we send 'campus' if the table uses it. The body has 'campus' (from frontend).
    // The frontend sends: campus, class_id, student_id, book_id, start_date, schedules.
    // Plus: student_name (maybe? check frontend). 
    // Frontend sends: student_id, book_id, start_date, schedules, campus, class_id.
    // It does NOT send student_name in the payload in handleCreate, but the table likely needs it?
    // Let's check if we should fetch student name or if frontend should send it.
    // Looking at frontend handleCreate:
    /*
      const payload = {
        campus: selectedCampus,
        class_id: selectedClassId,
        student_id: formData.student_id,
        book_id: formData.book_id,
        start_date: formData.start_date,
        schedules
      };
    */
    // It seems 'student_name' is missing in payload. I should add it or fetch it.
    // I will fetch it here since I already fetch the student for validation.
    
    let studentName = lessonData.student_name;
    let studentEnglishName = '';
    
    if (!studentName && student_id) {
        const { data: student } = await supabase.from('students').select('korean_name, english_name').eq('id', student_id).single();
        if (student) {
            studentName = student.korean_name;
            studentEnglishName = student.english_name;
        }
    }

    const lessonPayload = {
        student_id,
        book_id: lessonData.book_id,
        start_date: lessonData.start_date,
        memo: lessonData.memo,
        campus: campus, // Use extracted campus variable
        student_name: studentName, // Populate this
        // We don't store schedule JSON anymore
    };

    const { data: lesson, error: lessonError } = await supabase
      .from('private_lessons')
      .insert([lessonPayload])
      .select()
      .single();

    if (lessonError) {
      return NextResponse.json({ error: lessonError.message }, { status: 500 });
    }

    // 2. Insert Schedules
    if (schedules && Array.isArray(schedules) && schedules.length > 0) {
        const scheduleRows = schedules.map((s: any) => ({
            lesson_id: lesson.id,
            day_of_week: s.day_of_week,
            start_time: s.time,
            duration_minutes: 40 // Default duration, or pass from frontend
        }));

        const { error: scheduleError } = await supabase
            .from('private_lesson_schedules')
            .insert(scheduleRows);

        if (scheduleError) {
            // Should we delete the lesson? For now, just report error.
            console.error('Schedule insert error:', scheduleError);
            return NextResponse.json({ error: 'Lesson created but schedule failed: ' + scheduleError.message }, { status: 500 });
        }
    }

    return NextResponse.json(lesson);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
