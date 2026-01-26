import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type BookJoin = {
  id: string;
  name: string;
  category?: string | null;
  level?: string | null;
  total_units?: number | null;
  days_per_unit?: number | null;
};

type AllocationRow = {
  id: string;
  priority?: number | null;
  sessions_per_week?: number | null;
  books?: BookJoin | BookJoin[] | null;
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
    .from('class_book_allocations')
    .select(
      `
      id,
      priority,
      sessions_per_week,
      books:class_book_allocations_book_id_fkey (
        id,
        name,
        category,
        level,
        total_units,
        days_per_unit
      )
    `
    )
    .eq('class_id', id)
    .order('priority', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows: AllocationRow[] = Array.isArray(data) ? (data as unknown as AllocationRow[]) : [];
  const result = rows.map((r) => {
    const b = Array.isArray(r.books) ? r.books?.[0] : r.books;
    const totalUnits = b?.total_units ?? 0;
    const daysPerUnit = b?.days_per_unit ?? 0;
    const totalSessions = totalUnits && daysPerUnit ? totalUnits * daysPerUnit : 0;
    return {
      allocation_id: r.id as string,
      priority: (r.priority ?? 0) as number,
      sessions_per_week: (r.sessions_per_week ?? 0) as number,
      book: {
        id: (b?.id ?? '') as string,
        name: (b?.name ?? '') as string,
        category: (b?.category ?? 'others') as string,
        level: (b?.level ?? '') as string,
        total_units: (b?.total_units ?? 0) as number,
        days_per_unit: (b?.days_per_unit ?? 1) as number,
        total_sessions: totalSessions,
      },
    };
  });
  return NextResponse.json(result);
}
