
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseService();
    
    const { data, error } = await supabase
      .from('private_lessons')
      .select('*, private_lesson_schedules(*), private_lesson_books(book_id)')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Map books
    const books = data.private_lesson_books?.map((b: any) => b.book_id) || [];
    if (data.book_id && !books.includes(data.book_id)) {
        books.push(data.book_id);
    }

    const result = {
        ...data,
        book_ids: books
    };

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = getSupabaseService();

    const { data, error } = await supabase
      .from('private_lessons')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseService();

    // Optionally delete related lesson_plans first?
    // Postgres cascade should handle it if configured, but let's be safe
    // Actually, let's just delete the private_lesson and assume cascade or handle error
    
    const { error } = await supabase
      .from('private_lessons')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
