import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  // Fetch class A1a or all classes to check structure
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .ilike('name', '%A1a%')
    .limit(1);
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Class Data:', JSON.stringify(data, null, 2));
  }
}

main();
