import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60; // Allow 60s for PDF generation

export async function POST(req: NextRequest) {
  try {
    const { classId, year, month } = await req.json();

    if (!classId || year === undefined || month === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Determine executable path
    let executablePath = await chromium.executablePath();
    if (!executablePath) {
        // Fallback for local development (macOS)
        // If Chrome is not at this path, you may need to adjust it or install Chrome
        executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; 
    }

    const browser = await puppeteer.launch({
      args: (chromium as any).args,
      defaultViewport: (chromium as any).defaultViewport,
      executablePath: executablePath,
      headless: (chromium as any).headless,
      ignoreHTTPSErrors: true,
    } as any);

    const page = await browser.newPage();
    
    // Construct URL
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const origin = `${proto}://${host}`;
    
    // Pass params to preview page
    const url = `${origin}/pdf-preview?classId=${classId}&year=${year}&month=${month}`;

    console.log('Generating PDF from:', url);

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    
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
    const noticeData = {
        title: `📘 ${className} ${year}년 ${parseInt(month) + 1}월 수업계획안`,
        content: `PDF 다운로드 링크\n${publicUrl}`,
        class_ids: [classId],
        type: 'lesson_plan',
    };

    const { error: noticeError } = await supabase.from('notices').insert(noticeData);

    if (noticeError) {
        console.error('Notice Creation Error:', noticeError);
        // We return success for PDF but warn about notice? 
        // Or fail? The prompt implies "Must create notice".
        // But if PDF is uploaded, maybe just log it.
    }

    return NextResponse.json({ url: publicUrl, notice: !noticeError });

  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
