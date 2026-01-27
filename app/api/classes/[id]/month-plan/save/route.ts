import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

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
  const plan: Array<{ allocation_id: string; used_sessions: number }> = body?.plan || [];
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
  }
  if (!Array.isArray(plan) || plan.length === 0) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }
  const rows = plan.map(p => ({
    class_book_allocation_id: p.allocation_id,
    month,
    sessions: Math.max(0, Math.floor(p.used_sessions || 0)),
  }));
  const { error } = await supabase
    .from('course_sessions')
    .upsert(rows, { onConflict: 'class_book_allocation_id,month' });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: rows.length });
}
