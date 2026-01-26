//app/api/books/[id]
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const supabase = getSupabaseService();
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  const book = {
    id: data.id as string,
    name: data.name as string,
    category: (data.category as string) ?? 'others',
    level: (data.level as string) ?? '',
    unit_type: (data.unit_type as string) ?? 'unit',
    total_units: (data.total_units as number) ?? 0,
    days_per_unit: (data.days_per_unit as number) ?? 1,
    review_units: (data.review_units as number) ?? 0,
    progression_type: (data.progression_type as string) ?? 'unit-day',
    volume_count: (data.volume_count as number) ?? null,
    days_per_volume: (data.days_per_volume as number) ?? null,
    series: (data.series as string) ?? null,
    series_level: (data.series_level as string) ?? ((data.level as string) ?? null),
    units: [] as unknown[],
    total_sessions:
      (data.total_sessions as number) ??
      (((data.total_units as number) ?? 0) * (((data.days_per_unit as number) ?? 1))),
  };

  return NextResponse.json(book);
}
