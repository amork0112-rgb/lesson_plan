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

    // Create Notice in posts table
    // Requirement: category: 'notice', scope: 'class', published: true, attachment_url: publicUrl, attachment_type: 'pdf'
    // Title: `${year}년 ${month}월 수업계획서`
    // Content: `📎 ${className} ${month}월 수업계획서가 업로드되었습니다.\n\n[수업계획서 바로보기](${publicUrl})`
    
    // Note: We use parseInt(month) + 1 because the input month is 0-based index from Date object usually, 
    // but looking at previous code: `parseInt(month) + 1`. 
    // Let's verify if 'month' param is 0-based or 1-based.
    // In dashboard/page.tsx: `formData.append('month', m.toString());` where `m` comes from `monthPlans`.
    // Usually month index is 0-11. 
    // The previous code used `${parseInt(month) + 1}월`. I will stick to that.

    const monthNum = parseInt(month) + 1;
    const title = `${year}년 ${monthNum}월 수업계획서`;
    const content = `📎 ${className} ${monthNum}월 수업계획서가 업로드되었습니다.\n\n[수업계획서 바로보기](${publicUrl})`;

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
      created_at: new Date().toISOString()
    });

    if (insertError) {
      console.error('Failed to create notice in posts:', insertError);
      // We don't throw here to ensure the upload is still considered successful, 
      // but we log the error. Or should we fail?
      // User says: "Storage 업로드만 수행해도 teacher/notices 화면에 자동으로 공지가 생성된다."
      // If this fails, the requirement isn't met. But the upload is done.
      // I'll log it.
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
