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
  let eventsQuery = supabase.from('events').select('*');

  if (start) {
    holidaysQuery = holidaysQuery.gte('date', start);
    // For events, we want any event that overlaps or touches the range
    // Event ends after start date
    eventsQuery = eventsQuery.gte('end_date', start);
  }

  if (end) {
    holidaysQuery = holidaysQuery.lte('date', end);
    // Event starts before end date
    eventsQuery = eventsQuery.lte('start_date', end);
  }

  // Execute in parallel
  const [holidaysRes, eventsRes] = await Promise.all([
    holidaysQuery,
    eventsQuery
  ]);

  if (holidaysRes.error) {
    return NextResponse.json({ error: holidaysRes.error.message }, { status: 500 });
  }
  if (eventsRes.error) {
    return NextResponse.json({ error: eventsRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    holidays: holidaysRes.data || [],
    special_dates: eventsRes.data || []
  });
}
