//app/api/books/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('🔑 Supabase URL:', supabaseUrl ? 'OK' : 'MISSING');
  console.log('🔑 Service Key:', serviceKey ? 'OK' : 'MISSING');
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Supabase env missing');
    return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
  }

  const supabaseService = getSupabaseService();
  console.log('🔌 Supabase client created');
  const { data, error } = await supabaseService
    .from('books')
    .select('id,name,category,level,total_units,days_per_unit')
    .order('name', { ascending: true });

  console.log('📦 Supabase response:', {
    dataLength: Array.isArray(data) ? data.length : data ? 1 : 0,
    errorMessage: error ? error.message : null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type BookLite = {
    id: string;
    name: string;
    category?: string;
    level?: string;
    total_units?: number;
    days_per_unit?: number;
  };
  const list = Array.isArray(data) ? (data as BookLite[]) : [];
  const result = list.map((b) => {
    const total_sessions =
      (b.total_units ?? 0) && (b.days_per_unit ?? 0)
        ? (b.total_units ?? 0) * (b.days_per_unit ?? 0)
        : 0;
    return {
      id: b.id,
      name: b.name,
      category: b.category ?? 'others',
      level: b.level ?? '',
      total_units: b.total_units ?? 0,
      days_per_unit: b.days_per_unit ?? 1,
      total_sessions,
    };
  });

  return NextResponse.json(result);
}
