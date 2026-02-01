//app/api/classes/[id]/assigned-courses
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

type AllocationRow = {
  id: string;
  class_id: string;
  section: string | null;
  book_id: string;
  priority?: number;
  total_sessions: number | null;
  books?: { id: string; name: string; category: string; level: string } | { id: string; name: string; category: string; level: string }[];
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  
  const { data, error } = await supabase
    .from('class_book_allocations')
    .select(
      `
      id,
      class_id,
      section,
      book_id,
      priority,
      total_sessions,
      books:class_book_allocations_book_id_fkey (id,name,category,level)
    `
    )
    .eq('class_id', id)
    .neq('book_id', 'system_event')
    .neq('book_id', 'e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7')
    .order('priority', { ascending: true, nullsFirst: true })
    .order('section', { ascending: true });
  
  if (error) {
    console.error('❌ Error fetching allocations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  console.log(`📦 Found ${data?.length || 0} allocations for class ${id}`);
  const rows: AllocationRow[] = Array.isArray(data) ? (data as unknown as AllocationRow[]) : [];
  const ids = rows.map(r => r.id);
  
  // Use month_index instead of month
  const { data: sessData, error: sessErr } = await supabase
    .from('course_sessions')
    .select('class_book_allocation_id, month_index, sessions')
    .in('class_book_allocation_id', ids);
    
  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }
  
  const byAlloc: Record<string, Record<number, number>> = {};
  // Map using month_index
  (Array.isArray(sessData) ? sessData : []).forEach((s: { class_book_allocation_id: string; month_index: number; sessions: number | null }) => {
    if (!byAlloc[s.class_book_allocation_id]) byAlloc[s.class_book_allocation_id] = {};
    byAlloc[s.class_book_allocation_id][s.month_index] = s.sessions ?? 0;
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
      book: { 
        id: b?.id ?? r.book_id, 
        name: b?.name ?? '',
        category: b?.category ?? 'General',
        level: b?.level ?? ''
      },
      total_sessions: total,
      remaining_sessions: remaining,
      sessions_by_month: sessionsByMonth,
    };
  });
  return NextResponse.json(result);
}
