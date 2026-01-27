import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type AllocationRow = {
  id: string;
  class_id: string;
  section: string | null;
  book_id: string;
  total_sessions: number | null;
  books?: { id: string; name: string } | { id: string; name: string }[];
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const monthKey = searchParams.get('month'); // expected format YYYY-MM
  if (monthKey !== null) {
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json({ error: 'Invalid month format (YYYY-MM required)' }, { status: 400 });
    }
  }
  const { data, error } = await supabase
    .from('class_book_allocations')
    .select(
      `
      id,
      class_id,
      section,
      book_id,
      total_sessions,
      books:class_book_allocations_book_id_fkey (id,name)
    `
    )
    .eq('class_id', id)
    .order('section', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows: AllocationRow[] = Array.isArray(data) ? (data as unknown as AllocationRow[]) : [];
  const ids = rows.map(r => r.id);
  const { data: sessData, error: sessErr } = await supabase
    .from('course_sessions')
    .select('class_book_allocation_id,month,sessions')
    .in('class_book_allocation_id', ids);
  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }
  const byAlloc: Record<string, Record<number, number>> = {};
  (Array.isArray(sessData) ? sessData : []).forEach((s: { class_book_allocation_id: string; month: number; sessions: number | null }) => {
    if (!byAlloc[s.class_book_allocation_id]) byAlloc[s.class_book_allocation_id] = {};
    byAlloc[s.class_book_allocation_id][s.month] = s.sessions ?? 0;
  });
  const result = rows.map((r) => {
    const b = Array.isArray(r.books) ? r.books?.[0] : r.books;
    const sessionsByMonth = byAlloc[r.id] || {};
    const total = r.total_sessions ?? 0;
    const used = Object.values(sessionsByMonth).reduce((sum, v) => sum + (v || 0), 0);
    const remaining = total - used;
    return {
      id: r.id,
      section: r.section ?? 'others',
      book: { id: b?.id ?? r.book_id, name: b?.name ?? '' },
      total_sessions: total,
      remaining_sessions: remaining,
      sessions_by_month: sessionsByMonth,
    };
  });
  return NextResponse.json(result);
}
