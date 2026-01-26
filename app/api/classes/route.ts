import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type AllocationJoin = {
  id: string;
  priority: number;
  sessions_per_week: number;
  books: {
    id: string;
    name: string;
    total_units?: number | null;
    days_per_unit?: number | null;
  };
};

type ClassJoinRow = {
  id: string;
  name: string;
  campus?: string | null;
  class_book_allocations: AllocationJoin[];
};

export async function GET() {
  const supabaseService = getSupabaseService();
  const { data, error } = await supabaseService
    .from('classes')
    .select(
      `
      id,
      name,
      campus,
      class_book_allocations (
        id,
        priority,
        sessions_per_week,
        books (
          id,
          name,
          total_units,
          days_per_unit
        )
      )
    `
    )
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = Array.isArray(data) ? data : [];
  const result = rows.map((cls: any) => {
    const allocations = Array.isArray(cls.class_book_allocations)
      ? cls.class_book_allocations
      : [];
    const books = allocations.map((a: any) => {
      const bookObj = Array.isArray(a.books) ? a.books[0] : a.books;
      const totalUnits = bookObj?.total_units ?? 0;
      const daysPerUnit = bookObj?.days_per_unit ?? 0;
      return {
        book_id: bookObj?.id,
        book_name: bookObj?.name,
        priority: a?.priority,
        sessions_per_week: a?.sessions_per_week,
        total_sessions: totalUnits * daysPerUnit,
      };
    });
    return {
      id: cls?.id,
      name: cls?.name,
      campus: cls?.campus ?? null,
      books,
    };
  });

  return NextResponse.json(result);
}
