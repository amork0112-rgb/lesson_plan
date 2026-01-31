import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

const WEEKDAY_INT_MAP: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

export async function GET() {
  const supabase = getSupabaseService();
  
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform weekdays (int[]) to days (string[])
  const transformed = data.map((cls: any) => ({
    ...cls,
    days: Array.isArray(cls.weekdays)
      ? cls.weekdays.map((w: number) => WEEKDAY_INT_MAP[w]).filter(Boolean)
      : (cls.days || [])
  }));

  return NextResponse.json(transformed);
}
