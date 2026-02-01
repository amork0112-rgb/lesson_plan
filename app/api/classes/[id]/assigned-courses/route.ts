//app/api/classes/[id]/assigned-courses
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';
import { SYSTEM_EVENT_ID } from '@/lib/constants';

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
  
  // 1. Ensure System Event book exists
  console.log('🔍 Checking for System Event book...');
  const { data: eventBook, error: bookError } = await supabase.from('books').select('id').eq('id', SYSTEM_EVENT_ID).maybeSingle();
  
  if (bookError) {
    console.error('❌ Error checking event book:', bookError);
  }

  if (!eventBook) {
    console.log('✨ Creating System Event book...');
    const { error: insertError } = await supabase.from('books').insert({
        id: SYSTEM_EVENT_ID,
        name: 'Event',
        category: 'System',
        level: 'All',
        total_units: 999,
        days_per_unit: 1,
        unit_type: 'event',
        series: 'System',
        series_level: 'All'
    });
    if (insertError) {
      console.error('❌ Failed to insert System Event book:', insertError);
    } else {
      console.log('✅ System Event book created');
    }
  }

  // 2. Ensure System Event allocation exists for this class
  console.log(`🔍 Checking event allocation for class ${id}...`);
  const { data: eventAlloc, error: allocError } = await supabase
    .from('class_book_allocations')
    .select('id')
    .eq('class_id', id)
    .eq('book_id', SYSTEM_EVENT_ID)
    .maybeSingle();

  if (allocError) {
    console.error('❌ Error checking event allocation:', allocError);
  }

  if (!eventAlloc) {
    console.log('✨ Creating event allocation...');
    const { error: insertAllocError } = await supabase.from('class_book_allocations').insert({
        class_id: id,
        book_id: SYSTEM_EVENT_ID,
        priority: 0,
        sessions_per_week: 0,
        total_sessions: 0
    });
    if (insertAllocError) {
      console.error('❌ Failed to insert event allocation:', insertAllocError);
    } else {
      console.log('✅ Event allocation created');
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
      priority,
      total_sessions,
      books:class_book_allocations_book_id_fkey (id,name,category,level)
    `
    )
    .eq('class_id', id)
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
