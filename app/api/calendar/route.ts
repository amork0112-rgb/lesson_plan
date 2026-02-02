import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = getSupabaseService();
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  // Fetch from special_dates table
  let query = supabase.from('special_dates').select('*');

  if (start && end) {
    query = query.gte('date', start).lte('date', end);
  }

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch from academic_calendar table ('공휴일' or '방학')
  let holidaysQuery = supabase
    .from('academic_calendar')
    .select('*')
    .in('type', ['공휴일', '방학']);
  
  // Note: academic_calendar uses start_date/end_date. 
  // If we want to filter by range, we should check overlap.
  // For simplicity, checking if start_date is within range.
  if (start && end) {
    holidaysQuery = holidaysQuery.gte('start_date', start).lte('start_date', end);
  }
  const { data: dbHolidays, error: dbError } = await holidaysQuery;

  console.log('🗓️ API Calendar: Fetching...');
  console.log('   - Special Dates count:', events?.length);
  console.log('   - DB Holidays count:', dbHolidays?.length);
  if (dbError) console.error('   - DB Holidays Error:', dbError);

  const holidays: any[] = [];
  const special_dates: any[] = [];

  // Add DB Holidays first
  (dbHolidays || []).forEach((h: any) => {
      holidays.push({
          ...h,
          date: h.start_date, // Map start_date to date for frontend compatibility
          original_type: h.type, // Preserve original type ('공휴일', '방학')
          type: 'public_holiday' // Distinguish from custom 'no_class'
      });
  });

  (events || []).forEach((event: any) => {
    const { date, type, name, sessions, classes } = event;

    // Push to special_dates array for UI
    special_dates.push({
      date,
      type,
      name,
      sessions,
      classes
    });

    // If it's a 'no_class' event, also treat it as a holiday to block class generation
    if (type === 'no_class') {
      holidays.push({
        id: `sd_${date}`, // Unique ID for special date based holiday
        date: date,
        name: name || 'No Class',
        type: 'custom',
        year: parseInt(date.split('-')[0]),
        affected_classes: classes || [], // Applies to specific classes if set, else all
        sessions: sessions
      });
    }
  });

  return NextResponse.json({
    holidays,
    special_dates
  });
}
