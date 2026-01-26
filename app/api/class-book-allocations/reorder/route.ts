import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const body = await req.json();
  const classId: string | undefined = body.class_id;
  const orders: Array<{ allocation_id: string; priority: number }> | undefined = body.orders;
  if (!classId || !Array.isArray(orders) || orders.length === 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  for (const o of orders) {
    if (!o.allocation_id || typeof o.priority !== 'number' || o.priority < 1) {
      return NextResponse.json({ error: 'Invalid order item' }, { status: 400 });
    }
    const { error } = await supabase
      .from('class_book_allocations')
      .update({ priority: o.priority })
      .eq('id', o.allocation_id)
      .eq('class_id', classId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
