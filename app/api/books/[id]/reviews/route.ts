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
  const after_sequence: number | undefined = body?.after_sequence;
  if (typeof after_sequence !== 'number' || after_sequence < 0) {
    return NextResponse.json({ error: 'Invalid after_sequence' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('book_lesson_reviews')
    .insert({ book_id: id, after_sequence })
    .select('id,book_id,after_sequence,created_at')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
