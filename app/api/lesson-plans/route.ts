import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('🔥 [API/lesson-plans] route file loaded');
  console.log('➡️ [API/lesson-plans] GET called');
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
  const { data, error } = await supabaseService
    .from('lesson_plans')
    .select('id,date,class_id,content,book_id,unit_no,day_no,has_video_assignment, books(name, category)')
    .order('date', { ascending: false });

  console.log('📦 Supabase response:', {
    dataLength: Array.isArray(data) ? data.length : data ? 1 : 0,
    errorMessage: error ? error.message : null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
