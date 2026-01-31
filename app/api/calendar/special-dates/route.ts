import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export async function POST(req: Request) {
  const supabase = getSupabaseService();
  try {
    const body = await req.json();
    const { date, type, name } = body;
    
    // Delete existing entry for this date to ensure clean update (mimicking previous logic)
    await supabase.from('special_dates').delete().eq('date', date);
    
    const { error } = await supabase.from('special_dates').insert({ date, type, name });
    
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
