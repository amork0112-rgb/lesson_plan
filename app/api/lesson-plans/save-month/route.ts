import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';
import { LessonPlan } from '@/types';

export async function POST(req: Request) {
  const supabase = getSupabaseService();
  try {
    const body = await req.json();
    const { classId, year, month, lessons } = body;

    if (!classId || !lessons || !Array.isArray(lessons)) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Process lessons
    // We can't use a simple upsert because we need to check existence by (class_id, date)
    // and `id` might not be provided or consistent from the client generator.
    // However, if we assume (class_id, date) is unique, we can upsert on that conflict?
    // Supabase upsert requires a unique constraint.
    // Let's assume there is a unique constraint on (class_id, date) or we do it manually.
    // The previous client code did: select -> if exists update else insert.

    // Let's optimize by doing it in a loop for now or using `upsert` if we are sure about constraints.
    // If no unique constraint exists on (class_id, date), we must check manually.
    // Assuming no unique constraint for now to be safe and match previous logic.
    
    const results = [];
    
    for (const l of lessons) {
      const { data: existing } = await supabase
        .from('lesson_plans')
        .select('id')
        .eq('class_id', classId)
        .eq('date', l.date)
        .single();
      
      if (existing) {
        const { error } = await supabase
          .from('lesson_plans')
          .update({
            content: l.content,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lesson_plans')
          .insert({
            class_id: classId,
            date: l.date,
            content: l.content
          });
        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error saving monthly plan:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
