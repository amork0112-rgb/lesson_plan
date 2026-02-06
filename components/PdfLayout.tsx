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
    // Use Safe Hex Colors for PDF
    if (n.includes('wonder') || n.includes('reading')) return { color: '#65a30d' }; // lime-600
    if (n.includes('speak') || n.includes('english')) return { color: '#0ea5e9' }; // sky-500
    if (n.includes('word') || n.includes('voca')) return { color: '#f472b6' }; // pink-400
    if (n.includes('scp') || n.includes('writing')) return { color: '#fb923c' }; // orange-400
    if (n.includes('grammar')) return { color: '#a855f7' }; // purple-500
    return { color: '#1f2937' }; // gray-800
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
    <div id="pdf-root" className="print-only pdf-safe font-sans" style={{ backgroundColor: '#fff', color: '#000' }}>
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

      {/* Cover Page */}
      <div className="w-full h-screen flex flex-col justify-center items-center print:break-after-page" style={{ backgroundColor: '#fff' }}>
          <div className="text-center transform scale-125">
             {/* Logo */}
            <div className="flex items-center justify-center mb-8">
               <img src="/logo.png" alt="FRAGE EDU" className="h-24 object-contain" />
            </div>
            
            <h1 className="text-5xl font-extrabold mb-2 tracking-tight" style={{ color: '#1f2937' }}>{className}</h1>
            <h2 className="text-2xl font-medium uppercase tracking-widest" style={{ color: '#6b7280' }}>Lesson Plan</h2>
          </div>
      </div>

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
            .filter(c => c && c !== 'No Class')
        )).slice(0, 3).join(', ');

        return (
          <div key={key} className="w-full h-screen px-0 py-4 box-border flex flex-col relative print:h-screen print:break-after-page">
              
              {/* Header */}
              <div className="text-center mb-6 px-4">
                <div className="flex justify-between items-end pb-2">
                    <div className="text-left">
                        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#310080' }}>{className}</h1>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <h2 className="text-2xl font-bold leading-none" style={{ color: '#111827' }}>
                            {MONTH_NAMES[month]} <span className="text-lg font-medium" style={{ color: '#9ca3af' }}>[{monthDatesRange}]</span>
                        </h2>
                        {holidays && (
                            <span className="font-bold text-xs mt-1 px-2 py-0.5 rounded-full" style={{ color: '#dc2626', backgroundColor: '#fef2f2' }}>
                                {holidays}
                            </span>
                        )}
                    </div>
                </div>
              </div>

              {/* Grid / Table Container - Minimalist No Borders */}
              <div className="flex-1 px-4">
                 <div className="">
                  {(() => {
                    const cols = selectedDays.length === 3 ? 3 : 2;
                    const gridColsClass = cols === 3 ? 'grid-cols-3' : 'grid-cols-2';
                    
                    const rows: string[][] = [];
                    for (let i = 0; i < uniqueDates.length; i += cols) {
                      rows.push(uniqueDates.slice(i, i + cols));
                    }

                    return rows.map((datesRow, ri) => (
                      <div key={ri} className={`grid ${gridColsClass} gap-x-6 gap-y-8 mb-8`}>
                        {datesRow.map((dStr, colIndex) => {
                          const list = (byDate[dStr] || []).sort((a, b) => {
                            const pa = typeof a.period === 'number' ? a.period : 0;
                            const pb = typeof b.period === 'number' ? b.period : 0;
                            return pa - pb;
                          });
                          const dd = parseLocalDate(dStr);
                          const dayName = dd.toLocaleDateString('en-US',{weekday:'short'}); 
                          const dateText = `${dd.getMonth()+1}/${dd.getDate()} ${dayName}`;
                          
                          return (
                            <div key={dStr} className="flex flex-col min-h-[120px]">
                              {/* Date Header - Minimal Underline */}
                              <div className="mb-3 pb-1 flex justify-between items-baseline" style={{ borderBottom: '2px solid #e5e7eb' }}>
                                <span className="text-xl font-bold" style={{ color: '#1f2937' }}>{dateText.split(' ')[0]}</span>
                                <span className="text-sm font-medium uppercase" style={{ color: '#6b7280' }}>{dateText.split(' ')[1]}</span>
                              </div>
                              
                              {/* Content */}
                              <div className="space-y-3 flex-1 flex flex-col justify-start">
                                {list.map(item => {
                                  if (item.book_id === 'no_class' || item.book_id === 'school_event') {
                                      const isNoClass = item.book_id === 'no_class';
                                      return (
                                        <div key={item.id} className="w-full text-center py-1.5 rounded-md" 
                                            style={{ 
                                                backgroundColor: isNoClass ? '#fef2f2' : '#eff6ff', 
                                                color: isNoClass ? '#dc2626' : '#2563eb' 
                                            }}>
                                            <div className="font-bold text-xs">{item.content}</div>
                                        </div>
                                      );
                                  }

                                  const displayName = item.books?.name || item.book_name || '';
                                  const colorStyle = getBookStyle(displayName);
                                  
                                  return (
                                    <div key={item.id} className="w-full leading-snug">
                                      <div className="font-bold text-sm" style={colorStyle}>
                                        {displayName}
                                      </div>
                                      <div className="text-xs font-medium pl-1" style={{ color: '#4b5563', borderLeft: '2px solid #f3f4f6' }}>
                                        {item.content}
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

              {/* Footer */}
              <div className="mt-auto pt-4 flex flex-col items-center justify-center gap-1">
                  <p className="text-[10px]" style={{ color: '#9ca3af' }}>SCP = Speaking Certification Program 스피킹인증제</p>
                  <div className="flex items-center gap-1">
                      {/* Small Logo for Footer */}
                       <img src="/logo.png" alt="FRAGE EDU" className="h-8 object-contain" />
                  </div>
              </div>

          </div>
        );
      })}
    </div>
  );
}
