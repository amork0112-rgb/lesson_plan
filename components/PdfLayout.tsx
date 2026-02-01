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
    <div id="pdf-root" className="print-only bg-white font-sans">
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
      <div className="w-full h-screen flex flex-col justify-center items-center print:break-after-page bg-white">
          <div className="text-center">
            <h1 className="text-6xl font-extrabold text-[#310080] mb-4 tracking-tight">{className}</h1>
            <h2 className="text-3xl font-bold text-gray-600 mb-12">Lesson Plan</h2>
            
            {/* Logo */}
            <div className="flex items-center justify-center gap-4">
               {/* Shield Icon */}
               <svg width="80" height="90" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M50 95C50 95 90 75 90 25V10H10V25C10 75 50 95 50 95Z" fill="#310080" stroke="#009030" strokeWidth="6"/>
                  {/* Stylized Elephant/F shape */}
                  <path d="M35 30H70C73 30 73 35 70 35H50V45H65C68 45 68 50 65 50H50V75H35V30Z" fill="white"/>
                  <circle cx="68" cy="48" r="3" fill="#009030"/>
               </svg>
               <span className="text-6xl font-bold text-[#310080] tracking-tight" style={{ fontFamily: 'Arial, sans-serif' }}>FRAGE EDU</span>
            </div>
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
          <div key={key} className="w-full h-screen px-2 py-6 box-border flex flex-col relative print:h-screen print:break-after-page">
              
              {/* Header */}
              <div className="text-center mb-2 px-4">
                <div className="flex justify-between items-end border-b-2 border-[#310080] pb-2">
                    <div className="text-left">
                        <h1 className="text-2xl font-bold text-[#310080] tracking-tight">{className} Lesson Plan</h1>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <h2 className="text-xl font-bold text-gray-900 leading-none">
                            {MONTH_NAMES[month]} <span className="text-gray-600 text-lg">[{monthDatesRange}]</span>
                        </h2>
                        {holidays && (
                            <span className="text-red-500 font-bold text-xs mt-1">
                                {holidays}
                            </span>
                        )}
                    </div>
                </div>
              </div>

              {/* Grid / Table Container */}
              <div className="flex-1 px-1">
                 <div className="border-t border-l border-gray-300">
                  {(() => {
                    const cols = selectedDays.length === 3 ? 3 : 2;
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
                          const dayName = dd.toLocaleDateString('en-US',{weekday:'short'}); 
                          const dateText = `${dd.getMonth()+1}/${dd.getDate()} ${dayName}`;
                          
                          return (
                            <div key={dStr} className="border-r border-b border-gray-300 flex flex-col min-h-[100px]">
                              {/* Date Header */}
                              <div className="bg-gray-50 py-1 px-2 text-center font-bold text-gray-800 text-sm border-b border-gray-200">
                                {dateText}
                              </div>
                              
                              {/* Content */}
                              <div className="p-2 space-y-1 flex-1 flex flex-col justify-start items-center">
                                {list.map(item => {
                                  if (item.book_id === 'no_class' || item.book_id === 'school_event') {
                                      const isNoClass = item.book_id === 'no_class';
                                      return (
                                        <div key={item.id} className={`w-full text-center py-1 rounded ${isNoClass ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                            <div className="font-bold text-xs">{item.content}</div>
                                        </div>
                                      );
                                  }

                                  const colorClass = getBookStyle(item.book_name || '');
                                  
                                  return (
                                    <div key={item.id} className="text-center w-full leading-snug">
                                      <div className={`font-bold text-sm ${colorClass}`}>
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
                        {/* Fill empty cells */}
                        {datesRow.length < cols && Array.from({ length: cols - datesRow.length }).map((_, emptyIdx) => (
                             <div key={`empty-${emptyIdx}`} className="border-r border-b border-gray-300 bg-gray-50/10"></div>
                        ))}
                      </div>
                    ));
                  })()}
                 </div>
              </div>

              {/* Footer */}
              <div className="mt-2 pt-2 border-t border-gray-200 flex flex-col items-center justify-center gap-1">
                  <p className="text-[10px] text-gray-400">SCP = Speaking Certification Program 스피킹인증제</p>
                  <div className="flex items-center gap-1 opacity-80">
                      {/* Small Logo for Footer */}
                       <svg width="16" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M50 95C50 95 90 75 90 25V10H10V25C10 75 50 95 50 95Z" fill="#310080" stroke="#009030" strokeWidth="8"/>
                          <path d="M35 30H70C73 30 73 35 70 35H50V45H65C68 45 68 50 65 50H50V75H35V30Z" fill="white"/>
                       </svg>
                      <span className="text-[#310080] font-bold text-sm tracking-wide">FRAGE EDU</span>
                  </div>
              </div>

          </div>
        );
      })}
    </div>
  );
}
