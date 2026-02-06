import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  const { data: students } = await supabase.from('students').select('id, student_name, class_id, campus').limit(1);
  const { data: books } = await supabase.from('books').select('id, name').limit(1);
  console.log('Student:', JSON.stringify(students?.[0]));
  console.log('Book:', JSON.stringify(books?.[0]));
}

main();
