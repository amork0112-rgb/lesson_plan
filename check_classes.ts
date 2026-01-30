import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  const { data, error } = await supabase.from('classes').select('*');
  if (error) console.error('Error:', error);
  else console.log('Classes:', JSON.stringify(data, null, 2));
}

main();
