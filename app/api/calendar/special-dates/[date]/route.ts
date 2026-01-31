import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export async function DELETE(req: Request, { params }: { params: Promise<{ date: string }> }) {
  const supabase = getSupabaseService();
  const { date } = await params;
  
  // Delete single-day events on this date from academic_calendar
  const { error } = await supabase.from('academic_calendar')
      .delete()
      .eq('start_date', date)
      .eq('end_date', date);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
