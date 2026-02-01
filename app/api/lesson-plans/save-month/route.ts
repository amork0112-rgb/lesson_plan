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
    // Use DELETE + INSERT strategy to ensure clean state for the month
    // This handles removals, updates, and inserts correctly.
    
    // 1. Determine date range for this month plan
    // We can't just rely on month index because 'lessons' might contain dates from prev/next month (overflow)?
    // But usually 'save-month' is called with lessons filtered for that month.
    // Let's use the min/max date from the provided lessons to be safe, 
    // OR just use the year/month provided to define the range.
    // Using year/month is safer to clear the whole month bucket.
    
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Last day of month
    
    const minDateStr = startDate.toISOString().split('T')[0];
    const maxDateStr = endDate.toISOString().split('T')[0];

    // 2. Delete existing plans for this class in this range
    const { error: deleteError } = await supabase
        .from('lesson_plans')
        .delete()
        .eq('class_id', classId)
        .gte('date', minDateStr)
        .lte('date', maxDateStr);

    if (deleteError) throw deleteError;

    // 3. Insert new plans
    if (lessons.length > 0) {
        const payload = lessons.map((l: any) => ({
            class_id: classId,
            date: l.date,
            period: l.period || 1,
            book_id: l.book_id === 'no_class' ? null : l.book_id, // Handle no_class special case if needed, or keep 'no_class' if DB allows? DB expects UUID usually.
            // If book_id is 'no_class', we should probably set it to null or a special UUID?
            // Existing logic in generate route uses 'no_class' string? 
            // Let's check DB schema. usually book_id is uuid. 
            // If 'no_class', we might need to skip foreign key constraint or set null.
            // Let's assume for now we set null if it's not a valid UUID.
            book_name: l.book_name,
            content: l.content,
            display_order: l.display_order,
            unit_no: l.unit_no,
            day_no: l.day_no
        }));

        // Clean up payload: if book_id is 'no_class', set to null
        const cleanedPayload = payload.map((p: any) => {
             if (p.book_id === 'no_class') {
                 return { ...p, book_id: null };
             }
             return p;
        });

        const { error: insertError } = await supabase
            .from('lesson_plans')
            .insert(cleanedPayload);
            
        if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error saving monthly plan:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
