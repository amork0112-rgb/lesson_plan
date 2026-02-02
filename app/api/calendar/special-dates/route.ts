import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export async function POST(req: Request) {
  const supabase = getSupabaseService();

  try {
    const body = await req.json();
    const { 
      date, 
      type, 
      name, 
      sessions = 0,
      classes = null // 👈 핵심: null for all classes, or array of class IDs
    } = body;

    if (!date || !type) {
      throw new Error('Missing date or type');
    }

    // 👉 special_dates 기준 type 그대로 저장
    // type: 'school_event' | 'no_class' | 'makeup'

    // upsert (date unique 가정)
    const { error } = await supabase
      .from('special_dates')
      .upsert(
        {
          date,
          type,
          name: name || null,
          sessions,
          classes // TEXT[] or null
        },
        { onConflict: 'date' }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('🔥 special-dates POST error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
