//app/api/calendar/route.ts
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

  // Build query for academic_calendar
  let query = supabase.from('academic_calendar').select('*');

  if (start) {
    // Overlap logic: event_start <= query_end AND event_end >= query_start
    // For simplicity, just ensure we catch events that overlap with the range
    query = query.or(`start_date.lte.${end},end_date.gte.${start}`);
  }
  // Note: Simple filtering might be tricky with ranges, so fetching broader range or all might be safer if dataset is small.
  // Given it's a calendar, dataset for a year is small. Let's just fetch all or filter by year if possible.
  
  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Expand events into dates
  const holidays: any[] = [];
  const special_dates: any[] = [];

  const processDate = (dateStr: string, event: any) => {
    // Map types
    // 공휴일, 방학 -> No Class (Holiday)
    // 행사 -> School Event
    
    const type = event.type;
    
    if (type === '공휴일' || type === '방학') {
      holidays.push({
        id: `${event.id}_${dateStr}`,
        date: dateStr,
        name: event.name || event.title,
        type: 'national', // or 'custom', used for styling
        year: parseInt(dateStr.split('-')[0]),
        affected_classes: event.class_scope === 'all' ? [] : (event.class_scope ? [event.class_scope] : []),
        sessions: event.sessions
      });
      
      special_dates.push({
        date: dateStr,
        type: 'no_class',
        name: event.name || event.title,
        sessions: event.sessions
      });
    } else if (type === '행사') {
      special_dates.push({
        date: dateStr,
        type: 'school_event',
        name: event.name || event.title,
        sessions: event.sessions
      });
    }
  };

  (events || []).forEach((event: any) => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
       const dateStr = d.toISOString().split('T')[0];
       processDate(dateStr, event);
    }
  });

  return NextResponse.json({
    holidays,
    special_dates
  });
}
