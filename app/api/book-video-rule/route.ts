//app/api/book-video-rule/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { book_id, unit_no, day_no } = await req.json();
  if (!book_id || typeof unit_no !== 'number' || typeof day_no !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const { error } = await supabase
    .from('book_lesson_video_rules')
    .insert({ book_id, unit_no, day_no });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { book_id, unit_no, day_no } = await req.json();
  if (!book_id || typeof unit_no !== 'number' || typeof day_no !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const { error } = await supabase
    .from('book_lesson_video_rules')
    .delete()
    .eq('book_id', book_id)
    .eq('unit_no', unit_no)
    .eq('day_no', day_no);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
