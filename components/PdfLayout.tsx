'use client';

import { LessonPlan } from '@/types';

interface Props {
  lessons: LessonPlan[];
  className: string;
  selectedDays: string[];
  timeRange: string;
}

export default function PdfLayout({ lessons, className, selectedDays, timeRange }: Props) {
  const groups = Object.entries(lessons.reduce((acc, l) => {
    const d = new Date(l.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    (acc[key] ||= []).push(l);
    return acc;
  }, {} as Record<string, LessonPlan[]>));

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  return (
    <div id="pdf-root" className="pdf-root print-only p-8">
      <style>{`
        @media print {
          .pdf-root { font-family: 'Pretendard', sans-serif; }
          .pdf-title { text-align: center; font-size: 28px; font-weight: 800; }
          .pdf-sub { text-align: center; margin-bottom: 20px; }
          .pdf-month { font-size: 22px; margin: 20px 0; border-bottom: 3px solid #000; }
          .pdf-table { width: 100%; border-collapse: collapse; }
          .pdf-date { width: 140px; vertical-align: top; font-weight: 700; border-right: 2px solid #333; padding: 10px; }
          .pdf-content { padding: 10px; }
          .pdf-content div { margin-bottom: 4px; }
          .scp-line { color: #f59e0b; font-weight: 600; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>
      <div className="pdf-title">{className} Lesson Plan</div>
      <div className="pdf-sub">{selectedDays.join(' ')} {timeRange}</div>
      {groups.map(([key, items]) => {
        const [y, m] = key.split('-').map(Number);
        const byDate: Record<string, LessonPlan[]> = {};
        items.forEach(l => {
          (byDate[l.date] ||= []).push(l);
        });
        const uniqueDates = Object.keys(byDate).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
        return (
          <div key={key}>
            <div className="pdf-month">{MONTH_NAMES[m]} {y}</div>
            <table className="pdf-table">
              <tbody>
                {uniqueDates.map(dStr => {
                  const list = (byDate[dStr] || []).sort((a, b) => {
                    const pa = typeof a.period === 'number' ? a.period : 0;
                    const pb = typeof b.period === 'number' ? b.period : 0;
                    return pa - pb;
                  });
                  const dd = new Date(dStr);
                  const head = `${dd.getMonth()+1}/${dd.getDate()} ${dd.toLocaleDateString('en-US',{weekday:'short'})}`;
                  return (
                    <tr key={dStr}>
                      <td className="pdf-date">{head}</td>
                      <td className="pdf-content">
                        {list.map(item => (
                          <div key={item.id} className={item.book_id.startsWith('scp_') ? 'scp-line' : ''}>
                            {item.content || ''}
                          </div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
