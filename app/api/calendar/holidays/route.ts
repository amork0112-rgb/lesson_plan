import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export async function POST(req: Request) {
  const supabase = getSupabaseService();
  try {
    const body = await req.json();
    const { error } = await supabase.from('holidays').insert(body);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
