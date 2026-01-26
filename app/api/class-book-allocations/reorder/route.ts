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
  const orderedIds: string[] | undefined = body.ordered_ids;
  if (!classId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const { error } = await supabase
      .from('class_book_allocations')
      .update({ priority: i + 1 })
      .eq('id', id)
      .eq('class_id', classId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
