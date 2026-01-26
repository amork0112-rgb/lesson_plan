import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  const body = await _.json();
  const update: Record<string, unknown> = {};
  if (typeof body.priority === 'number') update.priority = body.priority;
  if (typeof body.sessions_per_week === 'number') update.sessions_per_week = body.sessions_per_week;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }
  const { error } = await supabase
    .from('class_book_allocations')
    .update(update)
    .eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { data: row, error: selErr } = await supabase
    .from('class_book_allocations')
    .select('id,priority,sessions_per_week,updated_at')
    .eq('id', id)
    .single();
  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  return NextResponse.json(row);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  const { error } = await supabase
    .from('class_book_allocations')
    .delete()
    .eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
