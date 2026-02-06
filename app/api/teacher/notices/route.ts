import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseService();
    const body = await req.json();
    const { title, content, class_ids } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        title,
        content,
        class_ids: class_ids || [],
        // author_id: can be fetched from session if needed, but this is a service role call
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notice:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('Internal Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
