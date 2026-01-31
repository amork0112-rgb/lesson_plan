import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  // We can't list tables easily with just the client, but we can try to query likely suspects
  // or just check if 'courses' exists.
  const { data: courses, error: coursesError } = await supabase.from('courses').select('*').limit(1);
  console.log('Courses table exists:', !coursesError, coursesError ? coursesError.message : '');
  
  const { data: books, error: booksError } = await supabase.from('books').select('*').limit(1);
  console.log('Books table exists:', !booksError);
  
  // Check for orphan allocations
  const { data: allocations, error: allocError } = await supabase
    .from('class_book_allocations')
    .select('book_id, books(id, name)');
    
  if (allocations) {
     const orphans = allocations.filter((a: any) => !a.books);
     console.log('Orphan Allocations Count:', orphans.length);
     console.log('Orphan Sample:', orphans.slice(0, 3));
  }
}

main();
