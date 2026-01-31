import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  const { data, error } = await supabase.from('classes').select('*').limit(1);
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

main();
