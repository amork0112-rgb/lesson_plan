import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  const body = await req.json();
  const insert_after_sequence: number | undefined = body?.insert_after_sequence;
  const has_video: boolean = !!body?.has_video;
  if (typeof insert_after_sequence !== 'number') {
    return NextResponse.json({ error: 'Invalid insert_after_sequence' }, { status: 400 });
  }
  const { data: later, error: selErr } = await supabase
    .from('book_lesson_items')
    .select('id,sequence')
    .eq('book_id', id)
    .gt('sequence', insert_after_sequence)
    .order('sequence', { ascending: false });
  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  const toShift: Array<{ id: string; sequence: number }> = Array.isArray(later)
    ? (later as Array<{ id: string; sequence: number }>)
    : [];
  for (const row of toShift) {
    const { error } = await supabase
      .from('book_lesson_items')
      .update({ sequence: row.sequence + 1 })
      .eq('id', row.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  const { data, error: insErr } = await supabase
    .from('book_lesson_items')
    .insert({
      book_id: id,
      item_type: 'review',
      sequence: insert_after_sequence + 1,
      has_video,
    })
    .select('id,item_type,sequence,has_video')
    .single();
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
