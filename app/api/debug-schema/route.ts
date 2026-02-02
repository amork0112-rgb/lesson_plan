import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseService();
  
  // Check private_lesson_schedules
  const { data: schedData, error: schedError } = await supabase
    .from('private_lesson_schedules')
    .select('*')
    .limit(1);

  // Check private_lessons columns
  const { data: plData, error: plError } = await supabase
    .from('private_lessons')
    .select('*')
    .limit(1);

  return NextResponse.json({
    schedules_table_error: schedError ? schedError.message : 'None',
    schedules_data: schedData,
    private_lessons_columns: plData && plData.length > 0 ? Object.keys(plData[0]) : 'No data'
  });
}
