import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type CourseRow = {
  id: string;
  class_id: string;
  section: string | null;
  book_id: string;
  is_secondary: boolean | null;
  total_sessions: number | null;
  books?: { id: string; name: string } | { id: string; name: string }[];
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  const { data, error } = await supabase
    .from('courses')
    .select(
      `
      id,
      class_id,
      section,
      book_id,
      is_secondary,
      total_sessions,
      books:courses_book_id_fkey (id,name)
    `
    )
    .eq('class_id', id)
    .order('section', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows: CourseRow[] = Array.isArray(data) ? (data as unknown as CourseRow[]) : [];
  const ids = rows.map(r => r.id);
  const { data: sessData, error: sessErr } = await supabase
    .from('course_sessions')
    .select('course_id,month,sessions')
    .in('course_id', ids);
  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }
  const byCourse: Record<string, Record<number, number>> = {};
  (Array.isArray(sessData) ? sessData : []).forEach((s: { course_id: string; month: number; sessions: number | null }) => {
    if (!byCourse[s.course_id]) byCourse[s.course_id] = {};
    byCourse[s.course_id][s.month] = s.sessions ?? 0;
  });
  const result = rows.map((r) => {
    const b = Array.isArray(r.books) ? r.books?.[0] : r.books;
    const sessionsByMonth = byCourse[r.id] || {};
    const total = r.total_sessions ?? 0;
    const used = Object.values(sessionsByMonth).reduce((sum, v) => sum + (v || 0), 0);
    const remaining = total - used;
    return {
      id: r.id,
      section: r.section ?? 'others',
      book: { id: b?.id ?? r.book_id, name: b?.name ?? '' },
      is_secondary: !!r.is_secondary,
      total_sessions: total,
      remaining_sessions: remaining,
      sessions_by_month: sessionsByMonth,
    };
  });
  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  const body = await req.json();
  console.log('📦 ADD COURSE BODY', body, 'class_id', id);
  const { section, book_id, is_secondary, total_sessions } = body;
  if (!section || !book_id || typeof total_sessions !== 'number' || total_sessions < 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('courses')
    .insert({
      class_id: id,
      section,
      book_id,
      is_secondary: !!is_secondary,
      total_sessions,
    })
    .select('id,class_id,section,book_id,is_secondary,total_sessions,created_at')
    .single();
  console.log('📦 INSERT RESULT', { data, error });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const months = [3,4,5,6,7,8,9,10,11,12,1,2];
  const rows = months.map(m => ({ course_id: data.id as string, month: m, sessions: 0 }));
  const { error: sessErr } = await supabase.from('course_sessions').upsert(rows);
  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
