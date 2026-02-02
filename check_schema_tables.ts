import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  const { data, error } = await supabase
    .from('private_lesson_schedules')
    .select('*')
    .limit(1);
    
  if (error) {
    console.log('Error accessing private_lesson_schedules:', error.message);
  } else {
    console.log('private_lesson_schedules exists.');
  }
  
  const { data: plData, error: plError } = await supabase
    .from('private_lessons')
    .select('*')
    .limit(1);
    
  if (plData && plData.length > 0) {
      console.log('private_lessons columns:', Object.keys(plData[0]));
  }
}

main();
