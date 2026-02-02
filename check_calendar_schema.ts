import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  
  // Check academic_calendar schema
  const { data, error } = await supabase
    .from('academic_calendar')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error fetching academic_calendar:', error.message);
  } else {
    console.log('academic_calendar sample:', JSON.stringify(data, null, 2));
  }
}

main();
