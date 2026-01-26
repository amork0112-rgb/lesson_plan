import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { itemId } = await params;
  const { data, error } = await supabase
    .from('book_lesson_items')
    .select('id,book_id,item_type,unit_no,day_no,sequence,has_video')
    .eq('id', itemId)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { itemId } = await params;
  const { data: item, error: selErr } = await supabase
    .from('book_lesson_items')
    .select('id,book_id,sequence')
    .eq('id', itemId)
    .single();
  if (selErr || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }
  const bookId = item.book_id as string;
  const deletedSeq = item.sequence as number;
  const { error: delErr } = await supabase
    .from('book_lesson_items')
    .delete()
    .eq('id', itemId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  const { data: later, error: listErr } = await supabase
    .from('book_lesson_items')
    .select('id,sequence')
    .eq('book_id', bookId)
    .gt('sequence', deletedSeq)
    .order('sequence', { ascending: true });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }
  const toShift: Array<{ id: string; sequence: number }> = Array.isArray(later)
    ? (later as Array<{ id: string; sequence: number }>)
    : [];
  for (const row of toShift) {
    const { error } = await supabase
      .from('book_lesson_items')
      .update({ sequence: row.sequence - 1 })
      .eq('id', row.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
