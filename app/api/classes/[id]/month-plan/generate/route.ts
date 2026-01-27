//app/api/classes/[id]/month-plan/generate
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type AllocationRow = {
  id: string;
  class_id: string;
  book_id: string;
  total_sessions: number | null;
  priority: number;
  sessions_per_week: number;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  const body = await req.json();
  const month: number = body?.month;
  const total_sessions: number = body?.total_sessions;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
  }
  if (!Number.isFinite(total_sessions) || total_sessions < 0) {
    return NextResponse.json({ error: 'Invalid total_sessions' }, { status: 400 });
  }

  const { data: allocData, error: allocErr } = await supabase
    .from('class_book_allocations')
    .select('id,class_id,book_id,total_sessions,priority,sessions_per_week')
    .eq('class_id', id)
    .order('priority', { ascending: true });
  if (allocErr) {
    return NextResponse.json({ error: allocErr.message }, { status: 500 });
  }
  const allocations: AllocationRow[] = Array.isArray(allocData) ? (allocData as AllocationRow[]) : [];
  if (allocations.length === 0) {
    return NextResponse.json({ plan: [], total_used: 0 });
  }
  const allocIds = allocations.map(a => a.id);
  const { data: sessData, error: sessErr } = await supabase
    .from('course_sessions')
    .select('class_book_allocation_id,month,sessions')
    .in('class_book_allocation_id', allocIds);
  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }
  const usedTotalByAlloc: Record<string, number> = {};
  (Array.isArray(sessData) ? sessData : []).forEach((s: { class_book_allocation_id: string; month: number; sessions: number | null }) => {
    usedTotalByAlloc[s.class_book_allocation_id] = (usedTotalByAlloc[s.class_book_allocation_id] || 0) + (s.sessions ?? 0);
  });

  const items = allocations
    .filter(a => !!a.id)
    .map(a => {
      const total = a.total_sessions ?? 0;
      const used = usedTotalByAlloc[a.id] || 0;
      const remaining = Math.max(0, total - used);
      return { ...a, remaining };
    })
    .filter(a => a.remaining > 0)
    .sort((a, b) => a.priority - b.priority);

  if (items.length === 0) {
    return NextResponse.json({ plan: [], total_used: 0 });
  }

  const totalWeight = items.reduce((sum, a) => sum + Math.max(1, a.sessions_per_week || 1), 0);
  const initialAlloc = items.map(a => {
    const share = Math.max(1, a.sessions_per_week || 1) / totalWeight;
    const target = Math.floor(total_sessions * share);
    const capped = Math.min(target, a.remaining);
    return { id: a.id, book_id: a.book_id, priority: a.priority, used: capped, remaining_after: a.remaining - capped };
  });
  let usedSum = initialAlloc.reduce((sum, x) => sum + x.used, 0);
  let leftover = Math.max(0, total_sessions - usedSum);
  while (leftover > 0 && usedSum < total_sessions) {
    let progressed = false;
    for (const a of initialAlloc) {
      if (leftover <= 0 || usedSum >= total_sessions) break;
      if (a.remaining_after > 0) {
        a.used += 1;
        a.remaining_after -= 1;
        leftover -= 1;
        usedSum += 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  const plan = initialAlloc
    .filter(p => p.used > 0)
    .map(p => ({ allocation_id: p.id, book_id: p.book_id, used_sessions: p.used, remaining_after: p.remaining_after }));
  return NextResponse.json({ month, total_used: usedSum, plan });
}
