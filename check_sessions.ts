import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  
  // Get a few sessions to see the month_index values
  const { data, error } = await supabase
    .from('course_sessions')
    .select('*')
    .limit(10);
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sample course_sessions:', JSON.stringify(data, null, 2));
  }
}

main();
