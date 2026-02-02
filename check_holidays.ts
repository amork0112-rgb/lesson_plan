import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  const { data, error } = await supabase.from('academic_calendar').select('*');
  if (error) console.error(error);
  else {
    console.log('Total holidays:', data.length);
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
  }
}

main();
