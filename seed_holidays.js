
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Manual Env Loading
function loadEnv(filename) {
  const filePath = path.resolve(process.cwd(), filename);
  if (fs.existsSync(filePath)) {
    console.log(`Loading ${filename}...`);
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv('.env.local');
loadEnv('.env');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Error: Supabase credentials missing from .env or .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function seed() {
  console.log('Checking existing holidays...');
  
  const { count, error } = await supabase
    .from('academic_calendar')
    .select('*', { count: 'exact', head: true })
    .gte('start_date', '2026-01-01')
    .lte('start_date', '2026-12-31')
    .eq('type', '공휴일');

  if (error) {
    console.error('Error checking holidays:', error);
    return;
  }

  if (count && count > 0) {
    console.log(`Found ${count} existing holidays. Skipping seed.`);
    return;
  }

  console.log('Seeding 2026 holidays...');
  const holidays = [
    { name: 'New Year\'s Day', start_date: '2026-01-01', end_date: '2026-01-01', type: '공휴일' },
    { name: 'Seollal Holiday', start_date: '2026-02-17', end_date: '2026-02-17', type: '공휴일' },
    { name: 'Seollal', start_date: '2026-02-18', end_date: '2026-02-18', type: '공휴일' },
    { name: 'Seollal Holiday', start_date: '2026-02-19', end_date: '2026-02-19', type: '공휴일' },
    { name: 'Independence Movement Day', start_date: '2026-03-01', end_date: '2026-03-01', type: '공휴일' },
    { name: 'Substitute Holiday', start_date: '2026-03-02', end_date: '2026-03-02', type: '공휴일' },
    { name: 'Children\'s Day', start_date: '2026-05-05', end_date: '2026-05-05', type: '공휴일' },
    { name: 'Buddha\'s Birthday', start_date: '2026-05-24', end_date: '2026-05-24', type: '공휴일' },
    { name: 'Substitute Holiday', start_date: '2026-05-25', end_date: '2026-05-25', type: '공휴일' },
    { name: 'Memorial Day', start_date: '2026-06-06', end_date: '2026-06-06', type: '공휴일' },
    { name: 'Liberation Day', start_date: '2026-08-15', end_date: '2026-08-15', type: '공휴일' },
    { name: 'Chuseok Holiday', start_date: '2026-09-24', end_date: '2026-09-24', type: '공휴일' },
    { name: 'Chuseok', start_date: '2026-09-25', end_date: '2026-09-25', type: '공휴일' },
    { name: 'Chuseok Holiday', start_date: '2026-09-26', end_date: '2026-09-26', type: '공휴일' },
    { name: 'National Foundation Day', start_date: '2026-10-03', end_date: '2026-10-03', type: '공휴일' },
    { name: 'Hangeul Day', start_date: '2026-10-09', end_date: '2026-10-09', type: '공휴일' },
    { name: 'Christmas Day', start_date: '2026-12-25', end_date: '2026-12-25', type: '공휴일' },
  ];

  const { data, error: insertError } = await supabase
    .from('academic_calendar')
    .insert(holidays)
    .select();

  if (insertError) {
    console.error('Error inserting holidays:', insertError);
  } else {
    console.log('Success! Seeded:', data.length, 'holidays.');
  }
}

seed();
