// app/api/books/[id]/lesson-items/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type LessonItemRow = {
  id: string;
  item_type: 'lesson' | 'review';
  unit_no?: number | null;
  day_no?: number | null;
  sequence: number;
  has_video: boolean;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  const { data, error } = await supabase
    .from('book_lesson_items')
    .select('id,item_type,unit_no,day_no,sequence,has_video')
    .eq('book_id', id)
    .order('sequence', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows: LessonItemRow[] = Array.isArray(data) ? (data as LessonItemRow[]) : [];
  const result = rows.map((r) => ({
    id: r.id,
    type: r.item_type,
    unitNo: r.unit_no ?? null,
    dayNo: r.day_no ?? null,
    sequence: r.sequence,
    hasVideo: !!r.has_video,
  }));
  return NextResponse.json(result);
}
