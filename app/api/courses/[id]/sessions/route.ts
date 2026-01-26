import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  const body = await req.json();
  if (body && typeof body.sessions_by_month === 'object') {
    const map = body.sessions_by_month as Record<number, number>;
    const entries = Object.entries(map)
      .map(([k, v]) => ({ month: Number(k), sessions: Number(v) }))
      .filter(e => Number.isInteger(e.month) && e.month >= 1 && e.month <= 12 && Number.isFinite(e.sessions) && e.sessions >= 0);
    if (entries.length > 0) {
      const rows = entries.map(e => ({ course_id: id, month: e.month, sessions: e.sessions }));
      const { error: upErr } = await supabase.from('course_sessions').upsert(rows);
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true });
  }
  const { month, sessions } = body as { month?: number; sessions?: number };
  if (typeof month !== 'number' || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
  }
  if (typeof sessions !== 'number' || sessions < 0) {
    return NextResponse.json({ error: 'Invalid sessions' }, { status: 400 });
  }
  const { data: existing, error: selErr } = await supabase
    .from('course_sessions')
    .select('id')
    .eq('course_id', id)
    .eq('month', month)
    .limit(1);
  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  if (Array.isArray(existing) && existing.length > 0) {
    const { error: updErr } = await supabase
      .from('course_sessions')
      .update({ sessions })
      .eq('course_id', id)
      .eq('month', month);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  } else {
    const { error: insErr } = await supabase
      .from('course_sessions')
      .insert({ course_id: id, month, sessions });
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
