
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob;
    const classId = formData.get('classId') as string;
    const year = formData.get('year') as string;
    const month = formData.get('month') as string;

    if (!file || !classId || !year || !month) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Convert Blob to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch class info for notice
    const { data: classData } = await supabase.from('classes').select('name').eq('id', classId).single();
    const className = classData?.name || 'Unknown Class';

    // File Path: lesson-plans/{classId}/{year}-{month}.pdf
    // Note: We use the server timestamp to avoid caching issues if re-uploaded
    const timestamp = Date.now();
    const filePath = `lesson-plans/${classId}/${year}-${month}_${timestamp}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('lesson-plans')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
        console.error('Supabase Upload Error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('lesson-plans')
      .getPublicUrl(filePath);

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('Share Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to share PDF' }, 
      { status: 500 }
    );
  }
}
