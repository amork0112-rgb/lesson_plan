import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  const { data, error } = await supabase.from('students').select('*').limit(5);
  if (error) {
    console.error('Error fetching students:', error.message);
  } else {
    console.log('Students sample:', JSON.stringify(data, null, 2));
  }
}

main();
