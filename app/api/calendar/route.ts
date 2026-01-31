import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const supabase = getSupabaseService();
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  // Build queries
  let holidaysQuery = supabase.from('holidays').select('*');
  let specialDatesQuery = supabase.from('special_dates').select('*');

  if (start) {
    holidaysQuery = holidaysQuery.gte('date', start);
    specialDatesQuery = specialDatesQuery.gte('date', start);
  }

  if (end) {
    holidaysQuery = holidaysQuery.lte('date', end);
    specialDatesQuery = specialDatesQuery.lte('date', end);
  }

  // Execute in parallel
  const [holidaysRes, specialDatesRes] = await Promise.all([
    holidaysQuery,
    specialDatesQuery
  ]);

  if (holidaysRes.error) {
    return NextResponse.json({ error: holidaysRes.error.message }, { status: 500 });
  }
  if (specialDatesRes.error) {
    return NextResponse.json({ error: specialDatesRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    holidays: holidaysRes.data || [],
    special_dates: specialDatesRes.data || []
  });
}
