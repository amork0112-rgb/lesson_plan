import { createClient } from '@supabase/supabase-js';
import PdfLayout from '@/components/PdfLayout';
import { generateLessons } from '@/lib/lessonEngine';
import { getDatesForMonth } from '@/lib/date';
import { Weekday, Class, Book, LessonPlan } from '@/types';

// Ensure no caching for this page to get fresh data
export const dynamic = 'force-dynamic';

export default async function PdfPreviewPage({ searchParams }: { searchParams: Promise<{ classId: string; year: string; month: string }> }) {
  const { classId, year, month } = await searchParams;
  const targetYear = parseInt(year);
  const targetMonth = parseInt(month); // 0-11

  // Init Admin Client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Fetch Class Info
  const { data: classData } = await supabase.from('classes').select('*').eq('id', classId).single();
  if (!classData) return <div>Class not found</div>;

  // 2. Fetch ALL Month Plans for the year (to ensure progress continuity)
  // We need to fetch plans for the target year. 
  // If the user needs cross-year continuity, we might need more, but per-year is standard.
  const { data: allMonthPlans } = await supabase.from('class_month_plans')
    .select('*')
    .eq('class_id', classId)
    .eq('year', targetYear)
    .order('month', { ascending: true });

  if (!allMonthPlans || allMonthPlans.length === 0) {
      return <div>No lesson plans found for this year.</div>;
  }

  // 3. Fetch Books
  // Collect all book IDs from all plans
  const allBookIds = new Set<string>();
  allMonthPlans.forEach((p: any) => {
      p.allocations?.forEach((a: any) => allBookIds.add(a.book_id));
  });
  
  const { data: booksData } = await supabase.from('books').select('*').in('id', Array.from(allBookIds));
  const books = booksData as Book[] || [];

  // 4. Fetch Holidays
  const { data: holidaysData } = await supabase.from('academic_calendar').select('*').eq('type', '공휴일').eq('year', targetYear);
  const holidays = (holidaysData || []).map((h: any) => ({
      ...h,
      date: h.start_date,
      type: 'public_holiday'
  }));

  // 5. Fetch Special Dates
  const { data: specialData } = await supabase.from('special_dates').select('*');
  const specialDates: Record<string, any> = {};
  specialData?.forEach((sd: any) => {
      specialDates[sd.date] = sd;
  });

  // 6. Generate Dates for ALL plans
  const selectedDays = classData.days as Weekday[];
  const planDates: Record<string, string[]> = {};

  allMonthPlans.forEach((p: any) => {
      planDates[p.id] = getDatesForMonth(p.year, p.month, selectedDays, holidays, specialDates, classId);
  });

  // 7. Generate Lessons
  const lessons = generateLessons({
      ownerId: classId,
      ownerType: 'class',
      monthPlans: allMonthPlans,
      planDates: planDates,
      selectedDays: selectedDays,
      books: books,
      scpType: classData.scp_type
  });

  // 8. Filter for Target Month
  const targetPlan = allMonthPlans.find((p: any) => p.month === targetMonth);
  if (!targetPlan) return <div>Target month plan not found.</div>;

  // Format time range
  const timeRange = `${classData.start_time}~${classData.end_time}`;

  return (
    <div className="pdf-safe">
      <PdfLayout 
        lessons={lessons}
        className={classData.name}
        selectedDays={selectedDays}
        timeRange={timeRange}
        monthPlans={[targetPlan]} // Only pass the target plan to render just that month
        planDates={planDates}
      />
    </div>
  );
}
