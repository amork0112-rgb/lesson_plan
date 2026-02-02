import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  console.log('🔥 [API/lesson-plans] route file loaded');
  console.log('➡️ [API/lesson-plans] GET called');
  
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get('owner_id');
  const ownerType = searchParams.get('owner_type');
  const classId = searchParams.get('class_id'); // Legacy support

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
  
  let query = supabaseService
    .from('lesson_plans')
    .select('id,date,class_id,owner_id,owner_type,content,book_id,unit_no,day_no,has_video_assignment, books(name, category)')
    .order('date', { ascending: false });

  if (ownerId) {
    query = query.eq('owner_id', ownerId);
  }
  if (ownerType) {
    query = query.eq('owner_type', ownerType);
  }
  // Legacy support: if class_id is passed but owner_id is not, treat class_id as owner_id (if type is class)
  // Or just filter by class_id column if it exists (which it does for backward compat)
  if (classId && !ownerId) {
    query = query.eq('class_id', classId);
  }

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
