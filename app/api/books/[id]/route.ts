//app/api/books/[id]
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';
import { generateBookUnits } from '@/lib/logic';
import type { Book } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const supabase = getSupabaseService();
  const { id } = await params;
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  const rawProg = (data.progression_type as string) ?? 'unit-day';
  const progression_type: 'unit-day' | 'volume-day' | 'lesson' =
    rawProg === 'volume-day' || rawProg === 'lesson' ? rawProg : 'unit-day';
  const book: Book = {
    id: data.id as string,
    name: data.name as string,
    category: (data.category as string) ?? 'others',
    level: (data.level as string) ?? '',
    unit_type: ((data.unit_type as string) ?? 'unit') as Book['unit_type'],
    total_units: ((data.total_units as number) ?? 0),
    days_per_unit: (data.days_per_unit as number) ?? 1,
    review_units: (data.review_units as number) ?? 0,
    progression_type,
    volume_count: (data.volume_count as number) ?? undefined,
    days_per_volume: (data.days_per_volume as number) ?? undefined,
    series: (data.series as string) ?? undefined,
    series_level: (data.series_level as string) ?? ((data.level as string) ?? undefined),
    total_sessions:
      (data.total_sessions as number) ??
      (((data.total_units as number) ?? 0) * (((data.days_per_unit as number) ?? 1))),
  };

  // Generate units and merge explicit video rules
  const units = generateBookUnits(book);
  const { data: rulesData } = await supabase
    .from('book_lesson_video_rules')
    .select('unit_no, day_no')
    .eq('book_id', id);
  const ruleSet = new Set<string>(
    Array.isArray(rulesData) ? rulesData.map((r: { unit_no: number; day_no: number }) => `${r.unit_no}-${r.day_no}`) : []
  );
  const mergedUnits = units.map(u => ({
    ...u,
    has_video: u.type === 'lesson' ? ruleSet.has(`${u.unit_no}-${u.day_no}`) : false
  }));

  return NextResponse.json({ ...book, units: mergedUnits });
}
