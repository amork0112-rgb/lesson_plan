import { getSupabaseService } from './lib/supabase-service';

async function main() {
  const supabase = getSupabaseService();
  
  // 1. Check classes table
  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('id, name, campus')
    .limit(10);
    
  if (classesError) console.error('Classes Error:', classesError);
  else {
      console.log('Classes Sample:', JSON.stringify(classes, null, 2));
      // Unique campuses
      const campuses = Array.from(new Set(classes.map((c: any) => c.campus)));
      console.log('Unique Campuses in classes table:', campuses);
  }

  // 2. Check the view v_classes_with_schedules
  const { data: viewData, error: viewError } = await supabase
    .from('v_classes_with_schedules')
    .select('class_id, class_name, campus')
    .limit(5);

  if (viewError) console.error('View Error:', viewError);
  else console.log('View Sample:', JSON.stringify(viewData, null, 2));
}

main();
