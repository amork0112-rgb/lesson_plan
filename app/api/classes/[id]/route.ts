import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  const { data, error } = await supabase
    .from('v_classes_with_schedules')
    .select('class_id,class_name,campus,weekdays,class_start_time,class_end_time')
    .eq('class_id', id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || null);
}
