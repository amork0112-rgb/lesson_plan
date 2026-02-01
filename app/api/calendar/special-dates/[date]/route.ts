import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export async function DELETE(req: Request, { params }: { params: Promise<{ date: string }> }) {
  const supabase = getSupabaseService();
  const { date } = await params;
  
  // Delete from special_dates table
  const { error } = await supabase
      .from('special_dates')
      .delete()
      .eq('date', date);
  
  if (error) {
    console.error('🔥 special-dates DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
