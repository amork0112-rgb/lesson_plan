import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

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
    .from('class_book_allocations')
    .select(`
      id,
      priority,
      sessions_per_week,
      books:class_book_allocations_book_id_fkey (id,name,total_units,days_per_unit)
    `)
    .eq('class_id', id)
    .order('priority', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  type BookJoinLite = { id: string; name: string; total_units?: number | null; days_per_unit?: number | null };
  type AllocationRow = { id: string; priority: number; sessions_per_week: number; books: BookJoinLite | BookJoinLite[] };
  const rows: AllocationRow[] = Array.isArray(data) ? (data as AllocationRow[]) : [];
  const result = rows.map((r: AllocationRow) => {
    const b = Array.isArray(r.books) ? r.books?.[0] : r.books;
    const total_sessions =
      (b?.total_units ?? 0) && (b?.days_per_unit ?? 0)
        ? (b.total_units as number) * (b.days_per_unit as number)
        : 0;
    return {
      allocation_id: r.id as string,
      priority: (r.priority as number) ?? 1,
      sessions_per_week: (r.sessions_per_week as number) ?? 1,
      book: {
        id: b?.id as string,
        name: (b?.name as string) ?? '',
        total_sessions,
      },
    };
  });
  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  const { book_id, priority, sessions_per_week } = await req.json();
  if (!book_id || typeof priority !== 'number' || typeof sessions_per_week !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('class_book_allocations')
    .insert({
      class_id: id,
      book_id,
      priority,
      sessions_per_week,
    })
    .select('id')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
