import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  
  // 1. Check/Create Book
  let { data: book } = await supabase.from('books').select('*').eq('id', 'system_event').single();
  if (!book) {
    console.log('Creating System Event Book...');
    const { error } = await supabase.from('books').insert({
      id: 'system_event',
      name: 'Event',
      category: 'System',
      level: 'All',
      total_units: 999,
      unit_type: 'day',
      days_per_unit: 1
    });
    if (error) console.error('Failed to create book:', error);
    else console.log('System Event Book created.');
  } else {
    console.log('System Event Book exists.');
  }
}

main();
