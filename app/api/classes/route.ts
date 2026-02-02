//app/api/classes/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

const WEEKDAY_INT_MAP: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

function parseWeekdays(input?: string | number[] | null): string[] | null {
  if (!input) return null;

  // Case 1: Already an array
  if (Array.isArray(input)) {
    if (input.length === 0) return [];
    
    // If numbers, map to strings
    if (typeof input[0] === 'number') {
      return (input as number[])
        .map((n) => WEEKDAY_INT_MAP[n])
        .filter(Boolean);
    }
    return input as unknown as string[];
  }

  // Case 2: Comma-separated string (e.g. "Mon,Tue" or "mon,tue" or "1,2")
  if (typeof input === 'string') {
    return input.split(',').map(s => {
      const trimmed = s.trim();
      // If it's a number string like "1"
      if (!isNaN(Number(trimmed))) {
        return WEEKDAY_INT_MAP[Number(trimmed)];
      }
      // If it's "mon", "Mon", etc.
      // Capitalize first letter
      const lower = trimmed.toLowerCase();
      const map: Record<string, string> = {
        mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun'
      };
      return map[lower] || trimmed; // Fallback to original if not found
    }).filter(Boolean);
  }

  return null;
}

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
  weekdays?: string | number[] | null;
  class_start_time?: string | null;
  class_end_time?: string | null;
  class_book_allocations: AllocationJoin[];
};

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // console.log('🔑 Supabase URL:', supabaseUrl ? 'OK' : 'MISSING');
  // console.log('🔑 Service Key:', serviceKey ? 'OK' : 'MISSING');
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Supabase env missing');
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const campus = searchParams.get('campus');

  const supabaseService = getSupabaseService();
  let query = supabaseService
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
        books (
          id,
          name,
          total_units,
          days_per_unit
        )
      )
    `
    );

  if (campus && campus !== 'All') {
    query = query.eq('campus', campus);
  }

  query = query.order('class_name', { ascending: true });

  const { data, error } = await query;

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
      weekdays: parseWeekdays(cls.weekdays),
      class_start_time: cls.class_start_time ?? null,
      class_end_time: cls.class_end_time ?? null,
      books,
    };
  });

  return NextResponse.json(result);
}
