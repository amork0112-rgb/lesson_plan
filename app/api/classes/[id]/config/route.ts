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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseService();
  
  const { data, error } = await supabase
    .from('v_classes_with_schedules')
    .select('class_id, class_name, weekdays')
    .eq('class_id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Parse weekdays safely
  let days: string[] = [];
  
  // Primary source: v_classes_with_schedules
  if (data?.weekdays) {
      if (Array.isArray(data.weekdays)) {
          if (data.weekdays.length > 0 && typeof data.weekdays[0] === 'number') {
              // Map integers to strings
              days = data.weekdays.map((w: number) => WEEKDAY_INT_MAP[w]).filter(Boolean);
          } else {
              // Assume strings
              days = data.weekdays;
          }
      }
  }

  // Fallback source: class_schedules (if view returned nothing)
  if (days.length === 0) {
      const { data: scheduleData } = await supabase
        .from('class_schedules')
        .select('day')
        .eq('class_id', id);
      
      if (scheduleData && scheduleData.length > 0) {
          days = scheduleData.map((row: any) => row.day).filter(Boolean);
      }
  }

  return NextResponse.json({
    id: data?.class_id || id,
    name: data?.class_name || '',
    weekdays: days // Return normalized strings
  });
}
