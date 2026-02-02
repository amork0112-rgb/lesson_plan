import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  
  // Check students columns
  const { data: students, error: sErr } = await supabase.from('students').select('*').limit(1);
  if (sErr) console.error('Students Error:', sErr);
  else console.log('Students Keys:', Object.keys(students[0] || {}));

  // Check private_lessons columns
  const { data: pl, error: pErr } = await supabase.from('private_lessons').select('*').limit(1);
  if (pErr) console.error('Private Lessons Error:', pErr);
  else console.log('Private Lessons Keys:', Object.keys(pl[0] || {}));

  // Check classes columns
  const { data: cl, error: cErr } = await supabase.from('classes').select('*').limit(1);
  if (cErr) console.error('Classes Error:', cErr);
  else console.log('Classes Keys:', Object.keys(cl[0] || {}));

  // Check if campuses table exists
  const { data: cmp, error: cmpErr } = await supabase.from('campuses').select('*').limit(1);
  if (cmpErr) console.log('Campuses Table probably does not exist or error:', cmpErr.message);
  else console.log('Campuses Keys:', Object.keys(cmp[0] || {}));
}

main();
