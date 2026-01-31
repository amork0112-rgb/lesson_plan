
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const report: any = {};
  
  try {
      const supabase = getSupabaseService();
  
      // 1. Check if 'courses' table exists and get data
      const { data: courses, error: coursesError } = await supabase.from('courses').select('*');
      report.coursesTable = { exists: !coursesError, count: courses?.length, sample: courses?.slice(0, 3) };

  // 2. Check 'assigned_courses' (which might be 'class_book_allocations' alias or similar)
  // The user mentioned "assignedCourses". The API uses 'class_book_allocations'.
  const { data: allocations, error: allocError } = await supabase
    .from('class_book_allocations')
    .select('id, book_id, class_id');
    
  // 3. Check 'books'
  const { data: books, error: booksError } = await supabase.from('books').select('id, name');
  const bookIds = new Set(books?.map(b => b.id));
  
  // 4. Find orphans
  const orphans = allocations?.filter(a => !bookIds.has(a.book_id)) || [];
  const orphanBookIds = [...new Set(orphans.map(a => a.book_id))];
  
  report.orphans = {
      count: orphanBookIds.length,
      ids: orphanBookIds
  };
  
  // 5. Try to match orphans to 'courses' table if it exists
  if (courses && courses.length > 0) {
      // Maybe 'courses' table has 'book_id' or 'id' that matches orphan IDs?
      // Or maybe 'courses' has 'name' and we can see if those match?
      
      const potentialMatches = courses.filter(c => orphanBookIds.includes(c.book_id) || orphanBookIds.includes(c.id));
      report.potentialMatchesInCourses = potentialMatches;
  }
  
  } catch (e: any) {
    return NextResponse.json({ error: e.message, report }, { status: 500 });
  }
  
  return NextResponse.json(report);
}
