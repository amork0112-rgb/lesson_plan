import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

type LessonItem =
  | { sequence: number; type: 'lesson'; unit: number; day: number; has_video: boolean }
  | { sequence: number; type: 'review' };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const supabase = getSupabaseService();
  const { id } = await params;

  const { data: book, error: bookErr } = await supabase
    .from('books')
    .select('id,name,total_units,days_per_unit')
    .eq('id', id)
    .single();
  if (bookErr || !book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  const totalUnits = (book.total_units as number) ?? 0;
  const daysPerUnit = (book.days_per_unit as number) ?? 1;

  const { data: videoRules } = await supabase
    .from('book_lesson_video_rules')
    .select('unit_no,day_no')
    .eq('book_id', id);
  const videoSet = new Set<string>(
    Array.isArray(videoRules)
      ? videoRules.map((r: { unit_no: number; day_no: number }) => `${r.unit_no}-${r.day_no}`)
      : []
  );

  const baseLessons: Array<{ position: number; item: LessonItem }> = [];
  let seq = 1;
  for (let u = 1; u <= totalUnits; u++) {
    for (let d = 1; d <= daysPerUnit; d++) {
      baseLessons.push({
        position: seq,
        item: {
          sequence: seq,
          type: 'lesson',
          unit: u,
          day: d,
          has_video: videoSet.has(`${u}-${d}`),
        },
      });
      seq++;
    }
  }

  const { data: reviews } = await supabase
    .from('book_lesson_reviews')
    .select('after_sequence')
    .eq('book_id', id);
  const reviewList = Array.isArray(reviews) ? reviews : [];
  for (const r of reviewList as Array<{ after_sequence: number }>) {
    const after = typeof r.after_sequence === 'number' ? r.after_sequence : 0;
    if (after >= 0) {
      baseLessons.push({
        position: after + 0.5,
        item: { sequence: 0, type: 'review' },
      });
    }
  }

  baseLessons.sort((a, b) => a.position - b.position);
  const lessons: LessonItem[] = baseLessons.map((entry, idx) => {
    const nextSeq = idx + 1;
    if (entry.item.type === 'lesson') {
      return { ...entry.item, sequence: nextSeq };
    }
    return { sequence: nextSeq, type: 'review' };
  });

  return NextResponse.json({
    book: { id: book.id as string, name: book.name as string },
    lessons,
  });
}
