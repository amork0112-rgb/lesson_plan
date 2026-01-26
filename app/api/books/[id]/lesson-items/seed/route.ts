import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

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
  const total_units: number | undefined = body?.total_units;
  const days_per_unit: number | undefined = body?.days_per_unit;
  if (!total_units || !days_per_unit || total_units < 1 || days_per_unit < 1) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const { count } = await supabase
    .from('book_lesson_items')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', id);
  if ((count || 0) > 0) {
    return NextResponse.json({ error: 'Items already exist' }, { status: 409 });
  }
  const rows: Array<{
    book_id: string;
    item_type: 'lesson';
    unit_no: number;
    day_no: number;
    sequence: number;
    has_video: boolean;
  }> = [];
  let seq = 1;
  for (let u = 1; u <= total_units; u++) {
    for (let d = 1; d <= days_per_unit; d++) {
      rows.push({
        book_id: id,
        item_type: 'lesson',
        unit_no: u,
        day_no: d,
        sequence: seq++,
        has_video: false,
      });
    }
  }
  const { error } = await supabase.from('book_lesson_items').insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ inserted: rows.length }, { status: 201 });
}
