// app/api/books/[id]/lesson-items/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

type LessonItemRow = {
  id: string;
  item_type: 'lesson' | 'review';
  unit_no?: number | null;
  day_no?: number | null;
  sequence: number;
  has_video: boolean;
};

// 1️⃣ GET (Fetch all items)
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }
  const supabase = getSupabaseService();
  const { id } = await params;
  
  const { data, error } = await supabase
    .from('book_lesson_items')
    .select('id,item_type,unit_no,day_no,sequence,has_video')
    .eq('book_id', id)
    .order('sequence', { ascending: true });
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  const rows: LessonItemRow[] = Array.isArray(data) ? (data as LessonItemRow[]) : [];
  const result = rows.map((r) => ({
    id: r.id,
    type: r.item_type,
    unitNo: r.unit_no ?? null,
    dayNo: r.day_no ?? null,
    sequence: r.sequence,
    hasVideo: !!r.has_video,
  }));
  
  return NextResponse.json(result);
}

// 2️⃣ PATCH (Handle updates: video toggle OR reorder)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseService();
  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: bookId } = await params;

  // Case A: Video Toggle
  if (body.itemId && typeof body.has_video === 'boolean') {
    const { error } = await supabase
      .from('book_lesson_items')
      .update({ has_video: body.has_video })
      .eq('id', body.itemId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // Case B: Reorder
  if (Array.isArray(body.items)) {
    const updates = body.items.map((i: any) =>
      supabase
        .from('book_lesson_items')
        .update({ sequence: i.sequence })
        .eq('id', i.id)
    );

    await Promise.all(updates);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid PATCH payload' }, { status: 400 });
}

// 3️⃣ POST (Add Review)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseService();
  const { afterSequence } = await req.json();
  const { id: bookId } = await params;

  // 1. Calculate new sequence
  // If afterSequence is provided, we want to insert AFTER it.
  // So newSeq = afterSequence + 1.
  // But we must shift everything >= newSeq by +1 to make room.
  
  let newSeq = 1;

  if (typeof afterSequence === 'number') {
    newSeq = afterSequence + 1;
    
    // Shift subsequent items
    const { error: shiftError } = await supabase.rpc('increment_sequence', {
      p_book_id: bookId,
      p_from_seq: newSeq
    });

    // If RPC doesn't exist or fails, we might need manual update
    // But let's assume we can do a manual update if RPC is missing
    if (shiftError) {
        // Manual shift fallback (less efficient but works)
        // Fetch all items with sequence >= newSeq
        const { data: toShift } = await supabase
            .from('book_lesson_items')
            .select('id, sequence')
            .eq('book_id', bookId)
            .gte('sequence', newSeq)
            .order('sequence', { ascending: false }); // Work backwards to avoid unique constraint issues if any
        
        if (toShift && toShift.length > 0) {
            for (const item of toShift) {
                await supabase
                    .from('book_lesson_items')
                    .update({ sequence: item.sequence + 1 })
                    .eq('id', item.id);
            }
        }
    }
  } else {
    // Append to end
    const { data: last } = await supabase
        .from('book_lesson_items')
        .select('sequence')
        .eq('book_id', bookId)
        .order('sequence', { ascending: false })
        .limit(1)
        .single();
    newSeq = (last?.sequence ?? 0) + 1;
  }

  const { error } = await supabase
    .from('book_lesson_items')
    .insert({
      book_id: bookId,
      item_type: 'review',
      unit_no: null,
      day_no: null,
      sequence: newSeq,
      has_video: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// 4️⃣ DELETE (Remove Review)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const supabase = getSupabaseService();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: bookId } = await params;

    // Supporting both body and query param for flexibility
    let itemId: string | null = null;
    
    try {
        // Try reading body first
        // clone() is sometimes needed if body is read multiple times, but here likely once.
        const body = await req.json();
        itemId = body.itemId;
    } catch {
        // If body parsing fails (e.g. no body), try query param
        const { searchParams } = new URL(req.url);
        itemId = searchParams.get('itemId');
    }

    if (!itemId) {
        return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
    }

    const { error } = await supabase
        .from('book_lesson_items')
        .delete()
        .eq('id', itemId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
