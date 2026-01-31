
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results = {
    fixed: [] as string[],
    errors: [] as string[],
    details: [] as any[]
  };

  try {
    const supabase = getSupabaseService();

    // 1. Get all allocations to find used book_ids
    const { data: allocations, error: allocError } = await supabase
      .from('class_book_allocations')
      .select('book_id');
    
    if (allocError) throw new Error(`Allocations fetch failed: ${allocError.message}`);

    const usedBookIds = [...new Set((allocations || []).map(a => a.book_id))];

    // 2. Get all existing books
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('id');

    if (booksError) throw new Error(`Books fetch failed: ${booksError.message}`);

    const existingBookIds = new Set((books || []).map(b => b.id));

    // 3. Identify missing books
    const missingBookIds = usedBookIds.filter(id => !existingBookIds.has(id));

    if (missingBookIds.length === 0) {
      return NextResponse.json({ message: 'All books are already registered.', results });
    }

    // 4. Try to find metadata for missing books from 'courses' table (Legacy/Source)
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, name, category, level, book_id'); // book_id might be the link, or id might be the link

    // Strategy: 
    // The 'book_id' in allocations might match 'courses.book_id' OR 'courses.id'.
    // Usually, allocations.book_id -> books.id.
    // And courses.book_id -> books.id.
    // If books entry is missing, maybe courses has the info?
    
    const coursesMap = new Map();
    if (courses) {
        courses.forEach((c: any) => {
            // Map both id and book_id to the course object for lookup
            if (c.id) coursesMap.set(c.id, c);
            if (c.book_id) coursesMap.set(c.book_id, c);
        });
    }

    // 5. Insert missing books
    for (const missingId of missingBookIds) {
      // Look up info
      const info = coursesMap.get(missingId);
      
      const newBook = {
        id: missingId,
        name: info?.name || `Restored Book (${missingId.substring(0, 8)})`,
        category: info?.category || 'others',
        level: info?.level || 'Unspecified',
        total_units: 24, // Default
        days_per_unit: 1, // Default
        // Add any other required fields
      };

      const { error: insertError } = await supabase
        .from('books')
        .insert(newBook);

      if (insertError) {
        results.errors.push(`Failed to insert ${missingId}: ${insertError.message}`);
      } else {
        results.fixed.push(newBook.name);
        results.details.push(newBook);
      }
    }

  } catch (e: any) {
    return NextResponse.json({ error: e.message, results }, { status: 500 });
  }

  return NextResponse.json({ 
    message: `Sync complete. Restored ${results.fixed.length} books.`, 
    results 
  });
}
