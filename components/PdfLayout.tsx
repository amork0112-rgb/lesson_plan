'use client';

import { LessonPlan } from '@/types';
import { parseLocalDate } from '@/lib/date';

interface Props {
  lessons: LessonPlan[];
  className: string;
  selectedDays: string[];
  timeRange: string;
  monthPlans?: { id: string; year: number; month: number }[];
  planDates?: Record<string, string[]>;
}

export default function PdfLayout({ lessons, className, selectedDays, timeRange, monthPlans, planDates }: Props) {
  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  let groups: { key: string; items: LessonPlan[]; year: number; month: number }[] = [];

  if (monthPlans && planDates) {
    groups = monthPlans.map(plan => {
      const allocatedDates = planDates[plan.id] || [];
      const planLessons = lessons.filter(l => allocatedDates.includes(l.date));
      return {
        key: plan.id,
        items: planLessons,
        year: plan.year,
        month: plan.month
      };
    }).filter(g => g.items.length > 0);
  } else {
    const grouped = lessons.reduce((acc, l) => {
      const d = parseLocalDate(l.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      (acc[key] ||= []).push(l);
      return acc;
    }, {} as Record<string, LessonPlan[]>);

    groups = Object.entries(grouped).map(([key, items]) => {
      const [y, m] = key.split('-').map(Number);
      return { key, items, year: y, month: m };
    });
  }

  return (
    <div id="pdf-root" className="print-only pt-16 px-8">
      {groups.map(({ key, items, year, month }, index, array) => {
        const byDate: Record<string, LessonPlan[]> = {};
        items.forEach(l => (byDate[l.date] ||= []).push(l));
        const uniqueDates = Object.keys(byDate).sort((a,b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime());
        const monthDatesRange = (() => {
          if (uniqueDates.length === 0) return '';
          const s = parseLocalDate(uniqueDates[0]);
          const e = parseLocalDate(uniqueDates[uniqueDates.length - 1]);
          const fmt = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`;
          return `${fmt(s)} ~ ${fmt(e)}`;
        })();
        
        return (
          <div key={key} className={index < array.length - 1 ? "" : ""} style={index < array.length - 1 ? { pageBreakAfter: 'always' } : {}}>
            <div className="mb-0 text-center">
              <h1 className="text-xl font-bold text-gray-900">{className} {MONTH_NAMES[month]} Lesson Plan</h1>
              <p className="text-gray-600 text-xs">{selectedDays.join(' ')} {timeRange} • {MONTH_NAMES[month]} {year} [{monthDatesRange}]</p>
            </div>
            <div className="space-y-2">
              {(() => {
                const cols = selectedDays.length === 3 ? 3 : 2;
                const rows: string[][] = [];
                for (let i = 0; i < uniqueDates.length; i += cols) {
                  rows.push(uniqueDates.slice(i, i + cols));
                }
                return rows.map((datesRow, ri) => (
                  <div key={ri} className={`grid gap-2 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {datesRow.map(dStr => {
                      const list = (byDate[dStr] || []).sort((a, b) => {
                        const pa = typeof a.period === 'number' ? a.period : 0;
                        const pb = typeof b.period === 'number' ? b.period : 0;
                        return pa - pb;
                      });
                          const dd = parseLocalDate(dStr);
                          const head = `${dd.getMonth()+1}/${dd.getDate()} ${dd.toLocaleDateString('en-US',{weekday:'short'})}`;
                          const isTrophyContent = (s?: string) => {
                            if (!s) return false;
                            return /^[A-Za-z0-9]+-\d+\s+Day\s+\d+$/i.test(s.trim());
                          };
                          return (
                            <div key={dStr} className="border rounded-lg overflow-hidden h-full flex flex-col">
                              <div className="px-2 py-1 bg-gray-100 text-gray-700 font-medium shrink-0">{head}</div>
                              <div className="p-2 space-y-1 grow">
                                {list.map(item => {
                                  if (item.book_id === 'no_class') {
                                    return (
                                      <div key={item.id} className="flex items-center gap-2 text-gray-800 p-2 bg-red-50 rounded border border-red-100 mb-1">
                                        <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-bold">No Class</span>
                                        <span className="font-medium text-sm">{item.content || 'No Class'}</span>
                                      </div>
                                    );
                                  }
                                  if (item.book_id === 'school_event') {
                                    return (
                                      <div key={item.id} className="flex items-center gap-2 text-gray-800 p-2 bg-blue-50 rounded border border-blue-100 mb-1">
                                        <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-bold">Event</span>
                                        <span className="font-medium text-sm">{item.content || 'School Event'}</span>
                                      </div>
                                    );
                                  }
                                  const m = item.content?.match(/Unit\s+(\d+)\s+Day\s+(\d+)/i);
                                  const u = m ? parseInt(m[1]) : undefined;
                                  const d = m ? parseInt(m[2]) : undefined;
                                  const isScp = item.book_id?.startsWith('scp_');
                                  return (
                                    <div key={item.id} className={`p-2 rounded-lg border ${isScp ? 'border-yellow-300 bg-yellow-50' : 'border-slate-200 bg-white'}`}>
                                      <div className="text-sm font-bold text-slate-900">{item.book_name}</div>
                                      <div className="mt-0.5 text-xs text-slate-600">
                                        {isTrophyContent(item.content)
                                          ? (item.content || '')
                                          : (typeof u === 'number' && typeof d === 'number'
                                              ? `Unit ${u} · Day ${d}`
                                              : (item.content || ''))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                  </div>
                ));
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
