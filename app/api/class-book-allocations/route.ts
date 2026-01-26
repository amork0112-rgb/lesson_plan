import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { class_id, book_id, priority, sessions_per_week } = await req.json();
  if (!class_id || !book_id) {
    return NextResponse.json({ error: 'class_id and book_id are required' }, { status: 400 });
  }
  if (typeof priority !== 'number' || priority < 1) {
    return NextResponse.json({ error: 'priority must be a number >= 1' }, { status: 400 });
  }
  if (typeof sessions_per_week !== 'number' || sessions_per_week < 1) {
    return NextResponse.json({ error: 'sessions_per_week must be a number >= 1' }, { status: 400 });
  }
  const { data: existing } = await supabase
    .from('class_book_allocations')
    .select('id')
    .eq('class_id', class_id)
    .eq('book_id', book_id)
    .limit(1);
  if (Array.isArray(existing) && existing.length > 0) {
    return NextResponse.json({ error: 'Allocation already exists' }, { status: 409 });
  }
  const { data, error } = await supabase
    .from('class_book_allocations')
    .insert({ class_id, book_id, priority, sessions_per_week })
    .select('id,class_id,book_id,priority,sessions_per_week,created_at')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
