import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseService();
  const { id } = await params;
  const { error } = await supabase.from('academic_calendar').delete().eq('id', id);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
