
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow 60s for PDF generation

export async function POST(req: NextRequest) {
  try {
    const { classId, year, month } = await req.json();

    if (!classId || year === undefined || month === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // Construct URL
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const origin = `${proto}://${host}`;
    
    // Pass params to preview page
    const url = `${origin}/pdf-preview?classId=${classId}&year=${year}&month=${month}`;

    console.log('Generating PDF from:', url);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#pdf-root', { timeout: 10000 });
    
    // Wait for fonts to be ready
    await page.evaluateHandle('document.fonts.ready');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });

    await browser.close();

    // Upload to Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch class info for notice
    const { data: classData } = await supabase.from('classes').select('name').eq('id', classId).single();
    const className = classData?.name || 'Unknown Class';

    // File Path: lesson-plans/{classId}/{year}-{month}.pdf
    const filePath = `lesson-plans/${classId}/${year}-${month}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('lesson-plans')
      .upload(filePath, pdfBuffer, {
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

    // Create Notice
    const { error: noticeError } = await supabase.from('notices').insert({
        title: `${year}년 ${month + 1}월 ${className} 수업계획안`,
        content: `${year}년 ${month + 1}월 ${className} 수업계획안이 등록되었습니다.\n첨부파일을 확인해주세요.`,
        class_id: classId,
        type: 'lesson_plan',
        file_url: publicUrl,
        is_active: true
    });

    if (noticeError) {
        console.error('Notice creation failed:', noticeError);
        // We don't fail the request here, just log it, as the PDF is already uploaded
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' }, 
      { status: 500 }
    );
  }
}
