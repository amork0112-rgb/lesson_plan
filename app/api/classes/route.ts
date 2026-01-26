import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type BookJoin = {
  id: string;
  name: string;
  total_units?: number | null;
  days_per_unit?: number | null;
};

type AllocationJoin = {
  id: string;
  priority: number;
  sessions_per_week: number;
  books: BookJoin | BookJoin[];
};

type ClassJoinRow = {
  class_id: string;
  class_name: string;
  campus?: string | null;
  weekdays?: number[] | null;
  class_start_time?: string | null;
  class_end_time?: string | null;
  class_book_allocations: AllocationJoin[];
};

export async function GET() {
  console.log('🔥 [API/classes] route file loaded');
  console.log('➡️ [API/classes] GET called');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('🔑 Supabase URL:', supabaseUrl ? 'OK' : 'MISSING');
  console.log('🔑 Service Key:', serviceKey ? 'OK' : 'MISSING');
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Supabase env missing');
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const supabaseService = getSupabaseService();
  const { data, error } = await supabaseService
    .from('v_classes_with_schedules')
    .select(
      `
      class_id,
      class_name,
      campus,
      weekdays,
      class_start_time,
      class_end_time,
      class_book_allocations (
        id,
        priority,
        sessions_per_week,
        books:class_book_allocations_book_id_fkey (
          id,
          name,
          total_units,
          days_per_unit
        )
      )
    `
    )
    .order('class_name', { ascending: true });

  console.log('📦 Supabase response:', {
    dataLength: Array.isArray(data) ? data.length : data ? 1 : 0,
    errorMessage: error ? error.message : null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: ClassJoinRow[] = Array.isArray(data) ? (data as ClassJoinRow[]) : [];
  const result = rows.map((cls) => {
    const allocations = Array.isArray(cls.class_book_allocations) ? cls.class_book_allocations : [];
    const books = allocations.map((a) => {
      const bookObj = Array.isArray(a.books) ? a.books[0] : a.books;
      const totalUnits = bookObj?.total_units ?? 0;
      const daysPerUnit = bookObj?.days_per_unit ?? 0;
      return {
        book_id: bookObj?.id,
        book_name: bookObj?.name,
        priority: a.priority,
        sessions_per_week: a.sessions_per_week,
        total_sessions: totalUnits * daysPerUnit,
      };
    });
    return {
      class_id: cls.class_id,
      class_name: cls.class_name,
      campus: cls.campus ?? null,
      weekdays: cls.weekdays ?? null,
      class_start_time: cls.class_start_time ?? null,
      class_end_time: cls.class_end_time ?? null,
      books,
    };
  });

  return NextResponse.json(result);
}
