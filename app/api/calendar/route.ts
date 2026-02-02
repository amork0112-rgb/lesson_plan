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

  const holidays: any[] = [];
  const special_dates: any[] = [];

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
