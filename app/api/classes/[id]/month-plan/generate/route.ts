import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

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
  const month_index: number = body?.month_index;
  const total_sessions: number = body?.total_sessions;
  const save: boolean = body?.save === true;
  if (!Number.isInteger(month_index) || month_index < 1) {
    return NextResponse.json({ error: 'Invalid month_index' }, { status: 400 });
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
    .select('class_book_allocation_id,month_index,sessions')
    .in('class_book_allocation_id', allocIds);
  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }
  const usedTotalByAlloc: Record<string, number> = {};
  (Array.isArray(sessData) ? sessData : []).forEach((s: { class_book_allocation_id: string; month_index: number; sessions: number | null }) => {
    usedTotalByAlloc[s.class_book_allocation_id] = (usedTotalByAlloc[s.class_book_allocation_id] || 0) + (s.sessions ?? 0);
  });

  const items = allocations
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
  while (leftover > 0) {
    let progressed = false;
    for (const a of initialAlloc) {
      if (leftover <= 0) break;
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

  if (save && plan.length > 0) {
    const upsertData = plan.map(p => ({
      class_book_allocation_id: p.allocation_id,
      month_index,
      sessions: p.used_sessions
    }));
    
    // First, we need to clear existing sessions for this month if they are not in the plan?
    // Actually, upsert will update existing. But if a book is NOT in the plan (0 sessions), we might need to set it to 0.
    // However, the 'plan' only contains used > 0.
    // If we want to fully reset the month, we should probably set others to 0.
    // But let's stick to updating what we calculated. 
    // Wait, if I re-generate and a book gets 0 sessions now, it should be updated to 0 in DB.
    // The current 'plan' filter(p => p.used > 0) removes 0s.
    // We should probably include 0s if we want to overwrite.
    // But let's assume the user wants to ADD sessions.
    // Actually, generation usually REPLACES the plan for that month.
    // So we should upsert all allocations for this class/month.
    
    // Let's include all from 'items' (allocations with remaining > 0) in the upsert, even if used is 0?
    // The initialAlloc contains all items.
    
    const fullPlan = initialAlloc.map(p => ({
      class_book_allocation_id: p.id,
      month_index,
      sessions: p.used
    }));

    const { error: saveErr } = await supabase
      .from('course_sessions')
      .upsert(fullPlan, { onConflict: 'class_book_allocation_id,month_index' });
      
    if (saveErr) {
      return NextResponse.json({ error: `Save failed: ${saveErr.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ month_index, total_used: usedSum, plan });
}
