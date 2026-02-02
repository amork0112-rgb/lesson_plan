import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = getSupabaseService();
  const { searchParams } = new URL(req.url);
  const campus = searchParams.get('campus');
  const classId = searchParams.get('class_id');
  const search = searchParams.get('search');

  try {
    let query = supabase.from('students').select('*');

    if (campus && campus !== 'All') {
      query = query.eq('campus', campus);
    }

    if (classId) {
      query = query.eq('class_id', classId);
    }

    if (search) {
      // Search by korean_name OR english_name
      // Syntax: or(column.operator.value, column.operator.value)
      query = query.or(`korean_name.ilike.%${search}%,english_name.ilike.%${search}%`);
    }

    // Limit results for autocomplete
    query = query.limit(20);

    const { data, error } = await query;

    if (error) {
        console.error('Students API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
