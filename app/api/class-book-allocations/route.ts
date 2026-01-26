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
  if (!class_id || !book_id || typeof priority !== 'number' || typeof sessions_per_week !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('class_book_allocations')
    .insert({ class_id, book_id, priority, sessions_per_week })
    .select('id')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
