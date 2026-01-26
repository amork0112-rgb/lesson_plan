import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { itemId } = await params;
  const body = await req.json();
  const has_video: boolean | undefined = body?.has_video;
  if (typeof has_video !== 'boolean') {
    return NextResponse.json({ error: 'Invalid has_video' }, { status: 400 });
  }
  const { error } = await supabase
    .from('book_lesson_items')
    .update({ has_video })
    .eq('id', itemId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
