//frage-lesson-plan/app/api/pdf/share/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob;
    const classId = formData.get('classId') as string;
    const year = formData.get('year') as string;
    // Month is no longer required for 6-month PDF
    // const month = formData.get('month') as string; 

    if (!file || !classId || !year) {
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

    // File Path: lesson-plans/{classId}/{year}-March-6mo.pdf
    // 6-month fixed name as per requirement
    const filePath = `lesson-plans/${classId}/${year}-March-6mo.pdf`;

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

    // Create or Update Notice
    // Title: 2026년 3월~8월 수업계획서
    const title = `${year}년 3월~8월 수업계획서`;
    const content = `📎 ${className} ${year}년 3월~8월 수업계획서가 업로드되었습니다.\n\n[수업계획서 바로보기](${publicUrl})`;

    // Check for existing notice
    const { data: existingPost } = await supabase
      .from('posts')
      .select('id')
      .eq('category', 'notice')
      .eq('scope', 'class')
      .eq('class_id', classId)
      .eq('title', title)
      .maybeSingle();

    if (existingPost) {
      // Update existing
      const { error: updateError } = await supabase
        .from('posts')
        .update({
          content,
          attachment_url: publicUrl,
        })
        .eq('id', existingPost.id);
        
       if (updateError) console.error('Notice update failed:', updateError);
    } else {
      // Insert new
      const { error: insertError } = await supabase.from('posts').insert({
        title,
        content,
        category: 'notice',
        scope: 'class',
        published: true,
        attachment_url: publicUrl,
        attachment_type: 'pdf',
        class_id: classId,
        creator_id: null, // System account
      });
      
      if (insertError) console.error('Notice creation failed:', insertError);
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('Share Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to share PDF' }, 
      { status: 500 }
    );
  }
}
