import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  
  console.log("Checking 'academic_calendar' table...");
  const { data: academicData, error: academicError } = await supabase
    .from('academic_calendar')
    .select('*')
    .limit(5);

  if (academicError) console.error("Error fetching academic_calendar:", academicError);
  else console.log("academic_calendar sample:", JSON.stringify(academicData, null, 2));

  console.log("\nChecking 'holidays' table...");
  const { data: holidaysData, error: holidaysError } = await supabase
    .from('holidays')
    .select('*')
    .limit(5);
    
  if (holidaysError) console.error("Error fetching holidays:", holidaysError);
  else console.log("holidays sample:", JSON.stringify(holidaysData, null, 2));
}

main();
