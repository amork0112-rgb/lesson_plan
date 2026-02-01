import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  const { data, error } = await supabase
    .from('special_dates')
    .select('*')
    .limit(1);
    
  if (error) {
      console.log('Error:', error.message);
  } else {
      console.log('Special Dates Sample:', data);
  }
}

main();
