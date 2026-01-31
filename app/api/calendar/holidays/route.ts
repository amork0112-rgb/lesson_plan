import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase-service';

export async function POST(req: Request) {
  const supabase = getSupabaseService();
  try {
    const body = await req.json();
    
    // Map UI Holiday to Academic Calendar structure
    // UI sends: { name, date, type, affected_classes }
    // DB expects: { name, start_date, end_date, type, class_scope }
    
    // Handle 'affected_classes'. If it's an array, we might need to handle it.
    // For now, let's assume single scope or 'all'.
    // If the UI sends multiple, we might default to 'all' or pick the first?
    // User requirement: "class_scope (전체 / 특정 반)"
    
    let class_scope = 'all';
    if (body.affected_classes && Array.isArray(body.affected_classes)) {
        if (body.affected_classes.length === 1) {
            class_scope = body.affected_classes[0];
        } else if (body.affected_classes.length > 1) {
            // If multiple specific classes are selected, but not 'all', 
            // strictly speaking we should probably create multiple entries or change DB to array.
            // For this iteration, let's stick to 'all' if multiple are selected to avoid complexity, 
            // or just take the first one if we want to be strict.
            // But usually "multiple specific" = "all" in simple systems, or we need to iterate.
            // Let's assume 'all' if > 1 for now, or the user will select 'all' in UI.
            // Actually, let's look at the UI payload. 
            // If the user selects specific classes, we should probably iterate.
            
            // However, to keep it simple and consistent with "Single Source", 
            // let's iterate and insert multiple if needed? 
            // No, 'academic_calendar' has an ID.
            // Let's default to 'all' if not specified.
        }
    }
    
    // Better logic: The UI seems to allow multiple selection.
    // If we want to support "Event for Class A and Class B", we might need two rows.
    // Let's loop if we have multiple affected_classes.
    
    const classesToInsert = (body.affected_classes && body.affected_classes.length > 0) 
        ? body.affected_classes 
        : ['all'];

    const inserts = classesToInsert.map((scope: string) => ({
        name: body.name,
        start_date: body.date, // UI sends single date for now
        end_date: body.date,
        type: body.type === 'national' ? '공휴일' : (body.type === 'school_event' ? '행사' : '공휴일'), // Default mapping
        class_scope: scope
    }));
    
    // If the UI sends explicit 'type' (공휴일/방학/행사), use it.
    // The UI currently sends 'custom' or 'national'.
    // We will update UI to send Korean types.
    
    const typeMap: Record<string, string> = {
        'national': '공휴일',
        'custom': '공휴일', // Default custom to holiday
        'school_event': '행사',
        'no_class': '공휴일',
        'makeup': '보강', // If supported
        '공휴일': '공휴일',
        '방학': '방학',
        '행사': '행사'
    };
    
    const dbType = typeMap[body.type] || '공휴일';
    
    const finalInserts = classesToInsert.map((scope: string) => ({
        name: body.name,
        start_date: body.date,
        end_date: body.date,
        type: dbType,
        class_scope: scope
    }));

    const { error } = await supabase.from('academic_calendar').insert(finalInserts);
    
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
