import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const supabase = getSupabaseService();
  const { id } = await params; // This is the allocation ID
  const body = await req.json();
  const { sessions_by_month } = body;

  if (!sessions_by_month || typeof sessions_by_month !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // We need to upsert sessions for this allocation
  // sessions_by_month is { month_key: count }
  
  const upserts = Object.entries(sessions_by_month).map(([m, count]) => ({
    class_book_allocation_id: id,
    month: parseInt(m, 10),
    sessions: typeof count === 'number' ? count : 0
  }));

  // We should probably delete existing sessions for this allocation that are NOT in the payload?
  // Or just upsert. The UI sends all 12 months (or 6 in the new version).
  // Ideally we use upsert on (class_book_allocation_id, month).
  
  // Note: 'course_sessions' must have a unique constraint on (class_book_allocation_id, month) for upsert to work properly
  // or we delete all for this allocation and insert new ones.
  // Deleting and inserting is safer if we don't know the constraint.
  
  // First, delete existing sessions for this allocation to avoid stale data (if we only send some months)
  // But usually we send all relevant months.
  // Let's try upsert.
  
  const { error } = await supabase
    .from('course_sessions')
    .upsert(upserts, { onConflict: 'class_book_allocation_id,month' });

  if (error) {
    // Fallback: Delete and Insert if constraint name is different or missing unique index
    console.error('Upsert failed, trying delete+insert', error);
    
    const { error: delErr } = await supabase
        .from('course_sessions')
        .delete()
        .eq('class_book_allocation_id', id);
        
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    
    const { error: insErr } = await supabase
        .from('course_sessions')
        .insert(upserts);
        
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
