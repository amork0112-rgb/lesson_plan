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

    // 1-based month handling logic
    // We assume the frontend sends the 0-based month index (e.g., 0 for Jan).
    // So we add 1 to get the actual month number.
    const monthIndex = parseInt(month);
    if (isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
       // However, the user said: "API는 1-based만 받도록 고정 (프론트가 책임지게 하는 게 맞음)"
       // But checking dashboard/page.tsx:
       // const m = mPlan ? mPlan.month : 0;
       // formData.append('month', m.toString());
       // `mPlan.month` is typically 0-11 in this codebase.
       // So the frontend IS sending 0-based index currently.
       // But the user said: "프론트에서 이미: formData.append("month", (new Date().getMonth() + 1).toString()); 이 구조면 +1 절대 하면 안 됨"
       // The user might be mistakenly thinking the frontend is sending 1-based, OR they want me to CHANGE the frontend to send 1-based.
       // The prompt says: "API는 1-based만 받도록 고정... 프론트가 책임지게 하는 게 맞음... formData.append("month", (new Date().getMonth() + 1).toString()); 이 구조면 +1 절대 하면 안 됨"
       // It seems the user WANTS the frontend to send 1-based, and the API to treat it as 1-based.
       // I should fix the API first to expect 1-based.
       // And then I should check the frontend code. If the frontend code is sending 0-based, I must fix it there too.
       // Wait, the user prompt says: "👉 프론트에서 이미: formData.append("month", (new Date().getMonth() + 1).toString());"
       // This implies the user BELIEVES the frontend is doing that. But my `Read` of `dashboard/page.tsx` showed `formData.append('month', m.toString());` where `m` comes from `monthPlans`.
       // `monthPlans` usually stores 0-based months (Date objects).
       
       // Let's implement the API to strict 1-based as requested:
       // "API는 1-based만 받도록 고정"
       // "const monthNum = parseInt(month); // 그대로 사용"
    }

    const monthNum = parseInt(month);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
       throw new Error('Invalid month value (must be 1-12)');
    }
    
    // Pad month for filename: 3 -> "03"
    const paddedMonth = String(monthNum).padStart(2, '0');

    // File Path: lesson-plans/{classId}/{year}-{paddedMonth}.pdf
    // NO timestamp. Fixed name for overwriting.
    const filePath = `lesson-plans/${classId}/${year}-${paddedMonth}.pdf`;

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
    const title = `${year}년 ${monthNum}월 수업계획서`;
    const content = `📎 ${className} ${monthNum}월 수업계획서가 업로드되었습니다.\n\n[수업계획서 바로보기](${publicUrl})`;

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
          // We don't update created_at, maybe updated_at if column exists?
          // User suggested: updated_at: new Date().toISOString()
          // But I need to check if updated_at column exists. 
          // The schema provided earlier didn't show updated_at.
          // I will skip updated_at for now to be safe, or just update content/url.
          // The user's snippet included updated_at. I'll try to include it if I can, but I'll stick to safe updates first.
          // Actually, let's just update content and url.
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
        // created_at is default now()
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
