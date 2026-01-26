import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  console.log('🔥 [API/calendar] route file loaded');
  console.log('➡️ [API/calendar] GET called');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('🔑 Supabase URL:', supabaseUrl ? 'OK' : 'MISSING');
  console.log('🔑 Service Key:', serviceKey ? 'OK' : 'MISSING');
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Supabase env missing');
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const supabaseService = getSupabaseService();
  console.log('🔌 Supabase client created');
  const { searchParams } = new URL(req.url);
  const campus = searchParams.get('campus');
  const weekKey = searchParams.get('week');

  let query = supabaseService
    .from('weekly_class_assignments')
    .select(
      `
      id,
      campus,
      class_name,
      week_key,
      status,
      suggested_due_date,
      confirmed_due_date,
      reason
    `
    )
    .order('week_key', { ascending: true });

  if (campus) query = query.eq('campus', campus);
  if (weekKey) query = query.eq('week_key', weekKey);

  const { data, error } = await query;

  console.log('📦 Supabase response:', {
    dataLength: Array.isArray(data) ? data.length : data ? 1 : 0,
    errorMessage: error ? error.message : null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
