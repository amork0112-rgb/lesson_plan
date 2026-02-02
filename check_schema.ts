
import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  // Try to select owner_type from lesson_plans
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('owner_type, owner_id')
    .limit(1);
    
  if (error) {
    console.error('Schema check failed:', error.message);
  } else {
    console.log('Schema check passed: owner_type and owner_id exist.');
  }
}

main();
