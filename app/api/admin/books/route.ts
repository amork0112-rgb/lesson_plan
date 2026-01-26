import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseService = getSupabaseService();
  const { data, error } = await supabaseService
    .from('books')
    .select('id,name,category,level,total_units,days_per_unit')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type BookLite = {
    id: string;
    name: string;
    category?: string;
    level?: string;
    total_units?: number;
    days_per_unit?: number;
  };
  const list = Array.isArray(data) ? (data as BookLite[]) : [];
  const result = list.map((b) => {
    const sessions =
      b.total_units && b.days_per_unit ? b.total_units * b.days_per_unit : null;
    return { ...b, sessions };
  });

  return NextResponse.json(result);
}
