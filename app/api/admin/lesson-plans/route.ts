import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseService = getSupabaseService();
  const { data, error } = await supabaseService
    .from('lesson_plans')
    .select('id,date,class_id,content,book_id,unit_no,day_no,has_video_assignment')
    .order('date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Optional: enrich with book name if relation isn't defined
  // This keeps it simple for now; front-end can join when needed.
  return NextResponse.json(data || []);
}
