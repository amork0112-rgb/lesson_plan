import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseService = getSupabaseService();
  const [special, holidays] = await Promise.all([
    supabaseService.from('special_dates').select('*'),
    supabaseService.from('holidays').select('*'),
  ]);

  if (special.error) {
    return NextResponse.json(
      { error: special.error.message },
      { status: 500 }
    );
  }

  if (holidays.error) {
    return NextResponse.json(
      { error: holidays.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    special_dates: special.data || [],
    holidays: holidays.data || [],
  });
}
