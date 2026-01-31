import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export async function POST(req: Request) {
  const supabase = getSupabaseService();
  try {
    const body = await req.json();
    const { date, type, name } = body;
    
    // Toggle logic usually sends:
    // type: 'no_class' | 'makeup' | 'school_event'
    // Map to academic_calendar types
    
    let dbType = '공휴일';
    if (type === 'school_event') dbType = '행사';
    else if (type === 'makeup') dbType = '보강'; // Assuming '보강' is allowed or we use a workaround
    else if (type === 'no_class') dbType = '공휴일';
    
    // Delete existing single-day events on this date to ensure clean state
    // We only delete events that match the single-day pattern to avoid deleting ranges?
    // But if the user toggles, they usually want to override.
    // However, we shouldn't break a 5-day vacation by toggling one day.
    // But for now, the UI toggle is simple. Let's assume it manages single-day overrides.
    // Or we just Insert. If there's an overlap, the 'Last One Wins' logic in UI might handle it.
    // But we want to avoid duplicates.
    
    // Strategy: Delete ANY single-day event on this date.
    await supabase.from('academic_calendar')
        .delete()
        .eq('start_date', date)
        .eq('end_date', date);
        
    // Insert new event
    const { error } = await supabase.from('academic_calendar').insert({
        name: name || (dbType === '행사' ? 'School Event' : 'Holiday'),
        start_date: date,
        end_date: date,
        type: dbType,
        class_scope: 'all' // Toggles are usually global in this UI
    });
    
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
