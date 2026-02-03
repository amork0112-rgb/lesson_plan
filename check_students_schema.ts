import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  // Try to insert a dummy query to see if it works or error details
  const { data, error } = await supabase.from('students').select('*').limit(1);
  if (error) {
    console.error('Error selecting students:', error);
  } else {
    console.log('Successfully selected student:', data);
  }
}

main();
