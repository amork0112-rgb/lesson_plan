import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseService();
  const { data, error } = await supabase
    .from('private_lessons')
    .select('*')
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
    const { student_id, class_id, campus_id } = body;
    
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
        
        // Note: student table uses 'campus' column, private_lessons uses 'campus_id' to store it
        if (campus_id && student.campus !== campus_id) {
             return NextResponse.json({ error: 'Student does not belong to the selected campus' }, { status: 400 });
        }
    }

    // Body: { student_name, instrument, start_date, schedule, memo, status }
    const { data, error } = await supabase
      .from('private_lessons')
      .insert([body])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
