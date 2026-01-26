import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabaseService = getSupabaseService();
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
