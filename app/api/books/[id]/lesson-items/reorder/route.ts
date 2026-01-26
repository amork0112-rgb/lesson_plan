import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  const body = await req.json();
  const items: Array<{ id: string; sequence: number }> | undefined = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Invalid items' }, { status: 400 });
  }
  const sequences = items.map((i) => i.sequence);
  const uniqueSeq = new Set(sequences);
  if (uniqueSeq.size !== sequences.length) {
    return NextResponse.json({ error: 'Duplicate sequence values' }, { status: 400 });
  }
  const ids = items.map((i) => i.id);
  const { data: rows, error: selErr } = await supabase
    .from('book_lesson_items')
    .select('id,book_id')
    .in('id', ids);
  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  const list = Array.isArray(rows) ? rows : [];
  if (list.length !== ids.length) {
    return NextResponse.json({ error: 'Some items not found' }, { status: 404 });
  }
  for (const r of list) {
    if ((r as { book_id: string }).book_id !== id) {
      return NextResponse.json({ error: 'Item does not belong to book' }, { status: 400 });
    }
  }
  for (const i of items) {
    const { error } = await supabase
      .from('book_lesson_items')
      .update({ sequence: i.sequence + 100000 })
      .eq('id', i.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  for (const i of items) {
    const { error } = await supabase
      .from('book_lesson_items')
      .update({ sequence: i.sequence })
      .eq('id', i.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
