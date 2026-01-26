'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Weekday } from '@/types';

const DAY_MAP: Record<Weekday, string> = { Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토', Sun: '일' };
function to12h(time?: string | null) {
  if (!time) return '';
  const [hh, mm] = time.split(':');
  const h = parseInt(hh, 10);
  const twelve = ((h % 12) || 12).toString();
  return `${twelve}:${mm}`;
}
function formatWeekdays(nums?: number[] | null) {
  if (!nums || nums.length === 0) return '';
  const mapIdx: Record<number, Weekday> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
  return nums.map(n => DAY_MAP[mapIdx[n] || 'Mon']).join('');
}

export default function ClassesPage() {
  type ClassView = {
    class_id: string;
    class_name: string;
    campus?: string | null;
    weekdays?: number[] | null;
    class_start_time?: string | null;
    class_end_time?: string | null;
    books: {
      book_id?: string;
      book_name?: string;
      priority?: number;
      sessions_per_week?: number;
      total_sessions?: number;
    }[];
  };
  const [classes, setClasses] = useState<ClassView[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  const filteredClasses = classes.filter(c =>
    c.class_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const fetchAll = async () => {
      const res = await fetch('/api/classes');
      const json: unknown = await res.json();
      if (Array.isArray(json)) {
        setClasses(json as unknown as ClassView[]);
      }
    };
    fetchAll();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-light text-slate-900 tracking-tight mb-2">Class Management</h1>
            <p className="text-slate-500 font-light">View classes and schedules.</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-10 relative max-w-lg">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-shadow"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4 w-40">Campus</th>
                <th className="px-6 py-4 w-40">Days</th>
                <th className="px-6 py-4 w-56">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredClasses.map((cls) => (
                <tr
                  key={cls.class_id}
                  onClick={() => router.push(`/classes/${cls.class_id}`)}
                  className="cursor-pointer hover:bg-indigo-50/30 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 group-hover:text-indigo-900 transition-colors">{cls.class_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700">{cls.campus || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700">{formatWeekdays(cls.weekdays)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-700">
                      {to12h(cls.class_start_time)} ~ {to12h(cls.class_end_time)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
