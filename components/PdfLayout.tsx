'use client';

import { LessonPlan } from '@/types';
import { parseLocalDate } from '@/lib/date';
import { Shield } from 'lucide-react';

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

  // Helper for colors based on book name keywords
  const getBookStyle = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('wonder') || n.includes('reading')) return 'text-lime-600';
    if (n.includes('speak') || n.includes('english')) return 'text-sky-500';
    if (n.includes('word') || n.includes('voca')) return 'text-pink-400';
    if (n.includes('scp') || n.includes('writing')) return 'text-orange-400';
    if (n.includes('grammar')) return 'text-purple-500';
    return 'text-gray-800';
  };

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
    <div id="pdf-root" className="print-only bg-white">
      <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 0mm;
          }
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
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

        // Holiday Summary
        const holidays = Array.from(new Set(
          items
            .filter(l => l.book_id === 'no_class')
            .map(l => l.content || '')
            .filter(c => c && c !== 'No Class') // Filter out generic "No Class" if it has no specific name, but usually content is the name
        )).slice(0, 3).join(', '); // Limit to 3 to avoid clutter

        return (
          <div key={key} className="w-full h-screen p-4 box-border flex flex-col relative print:h-screen print:break-after-page">
            {/* Outer Blue Frame */}
            <div className="flex-1 border-[3px] border-sky-200 rounded-[2rem] p-4 relative flex flex-col shadow-[0_0_0_1px_rgba(224,242,254,0.5)]">
              
              {/* Spiral Binding Effect */}
              <div className="absolute -top-3 left-0 w-full flex justify-center gap-6 px-12 z-10">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-4 h-8 bg-gradient-to-b from-gray-100 to-gray-300 border border-gray-400 rounded-full shadow-sm"></div>
                ))}
              </div>

              {/* Header */}
              <div className="text-center mb-4 mt-2">
                <h1 className="text-3xl font-bold text-indigo-900 tracking-tight">{className} Lesson Plan</h1>
                <div className="flex justify-center items-center gap-3 mt-1">
                   <h2 className="text-xl font-bold text-gray-900">
                     {MONTH_NAMES[month]} <span className="text-gray-800">[{monthDatesRange}]</span>
                   </h2>
                   {holidays && (
                      <span className="text-red-400 font-bold text-sm bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                        {holidays}
                      </span>
                   )}
                </div>
              </div>

              {/* Grid / Table Container */}
              <div className="flex-1">
                 <div className="border-t border-l border-gray-300">
                  {(() => {
                    const cols = selectedDays.length === 3 ? 3 : 2; // Default to 3 columns if 3 days, else 2 (or 3 if 2 days? user image has 3 cols)
                    // The user image shows 3 cols for Tue/Thu/Fri.
                    // If selectedDays is 2 (Tue/Thu), maybe we still use 3 cols or just 2? 
                    // Let's stick to matching selectedDays count, but max 3 looks good.
                    // Actually, if we want strict table look, we should fill the row.
                    
                    const gridColsClass = cols === 3 ? 'grid-cols-3' : 'grid-cols-2';
                    
                    const rows: string[][] = [];
                    for (let i = 0; i < uniqueDates.length; i += cols) {
                      rows.push(uniqueDates.slice(i, i + cols));
                    }

                    return rows.map((datesRow, ri) => (
                      <div key={ri} className={`grid ${gridColsClass}`}>
                        {datesRow.map((dStr, colIndex) => {
                          const list = (byDate[dStr] || []).sort((a, b) => {
                            const pa = typeof a.period === 'number' ? a.period : 0;
                            const pb = typeof b.period === 'number' ? b.period : 0;
                            return pa - pb;
                          });
                          const dd = parseLocalDate(dStr);
                          const dayName = dd.toLocaleDateString('en-US',{weekday:'short'}); // Fri, Tue
                          const dateText = `${dd.getMonth()+1}/${dd.getDate()} ${dayName}`;
                          
                          // Determine if this is the last item in row or column to manage borders?
                          // Tailwind grid gap-0 + borders on items usually requires handling double borders.
                          // We used border-t border-l on container.
                          // So items need border-r and border-b.
                          
                          return (
                            <div key={dStr} className="border-r border-b border-gray-300 flex flex-col h-full min-h-[120px]">
                              {/* Date Header */}
                              <div className="bg-gray-100 py-1.5 px-3 text-center font-bold text-gray-800 text-sm border-b border-gray-200">
                                {dateText}
                              </div>
                              
                              {/* Content */}
                              <div className="p-3 space-y-2 flex-1 flex flex-col justify-start items-center">
                                {list.map(item => {
                                  if (item.book_id === 'no_class' || item.book_id === 'school_event') {
                                      const isNoClass = item.book_id === 'no_class';
                                      return (
                                        <div key={item.id} className={`w-full text-center py-2 rounded ${isNoClass ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                            <div className="font-bold text-sm">{item.content}</div>
                                        </div>
                                      );
                                  }

                                  const colorClass = getBookStyle(item.book_name || '');
                                  
                                  return (
                                    <div key={item.id} className="text-center w-full">
                                      <div className={`font-bold text-sm leading-tight ${colorClass} mb-0.5`}>
                                        {item.book_name}
                                      </div>
                                      <div className="text-xs text-gray-600 font-medium">
                                        {item.content}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {/* Fill empty cells if row is incomplete to maintain grid borders? */}
                        {datesRow.length < cols && Array.from({ length: cols - datesRow.length }).map((_, emptyIdx) => (
                             <div key={`empty-${emptyIdx}`} className="border-r border-b border-gray-300 bg-gray-50/30"></div>
                        ))}
                      </div>
                    ));
                  })()}
                 </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t-2 border-gray-100 flex flex-col items-center justify-center gap-2">
                  <p className="text-xs text-gray-500 font-medium">SCP = Speaking Certification Program 스피킹인증제</p>
                  <div className="flex items-center gap-2">
                      <div className="bg-indigo-900 text-white rounded p-1">
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="text-indigo-900 font-bold text-lg tracking-wide">FRAGE EDU</span>
                  </div>
              </div>

            </div>
          </div>
        );
      })}
    </div>
  );
}
