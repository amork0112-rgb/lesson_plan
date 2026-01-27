//app/classes/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';

type ClassView = {
  class_id: string;
  class_name: string;
  campus?: string | null;
  weekdays?: number[] | null;
  class_start_time?: string | null;
  class_end_time?: string | null;
  books: {
    allocation_id?: string;
    book_id?: string;
    book_name?: string;
    priority?: number;
    sessions_per_week?: number;
    total_sessions?: number;
  }[];
};

type BookLite = {
  id: string;
  name: string;
  category?: string;
  level?: string;
  total_units?: number;
  days_per_unit?: number;
  total_sessions?: number;
};

type CourseView = {
  id: string;
  section: string;
  book: { id: string; name: string };
  total_sessions: number;
  remaining_sessions: number;
  sessions_by_month: Record<number, number>;
};

export default function ClassDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [clazz, setClazz] = useState<ClassView | null>(null);
  const [allBooks, setAllBooks] = useState<BookLite[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [courses, setCourses] = useState<CourseView[]>([]);
  const [addingCourse, setAddingCourse] = useState<boolean>(false);
  const [newCourse, setNewCourse] = useState<{ book_id: string | null; total_sessions: number }>({
    book_id: null,
    total_sessions: 0,
  });
  const [genMonth, setGenMonth] = useState<number>(3);
  const [genTotal, setGenTotal] = useState<number>(0);
  const [genResult, setGenResult] = useState<Array<{ allocation_id: string; book_id: string; used_sessions: number; remaining_after: number }>>([]);

  useEffect(() => {
    const rawId = Array.isArray(id) ? id[0] : id;
    const load = async () => {
      const res = await fetch('/api/classes');
      const json: unknown = await res.json();
      const arr = Array.isArray(json) ? (json as ClassView[]) : [];
      const found = arr.find(c => c.class_id === rawId);
      setClazz(found || null);
      if (found) {
        const cr = await fetch(`/api/classes/${found.class_id}/courses`);
        const clist: unknown = await cr.json();
        if (Array.isArray(clist)) {
          setCourses(clist as CourseView[]);
        }
      }
    };
    const loadBooks = async () => {
      const res = await fetch('/api/books');
      const json: unknown = await res.json();
      setAllBooks(Array.isArray(json) ? (json as BookLite[]) : []);
    };
    load();
    loadBooks();
  }, [id]);

  const filteredBooks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = term ? allBooks.filter(b => b.name.toLowerCase().includes(term)) : allBooks;
    return list;
  }, [allBooks, searchTerm]);

  const weekdayMap: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
  const daysText = (clazz?.weekdays || []).map((n) => weekdayMap[n] || '').filter(Boolean).join(' / ');
  const timeText = clazz?.class_start_time && clazz?.class_end_time ? `${clazz.class_start_time} ~ ${clazz.class_end_time}` : '';

  if (!clazz) {
    return (
      <div className="p-8">
        <button onClick={() => router.push('/classes')} className="text-slate-500 hover:text-slate-800 mb-4 flex items-center">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Classes
        </button>
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <button onClick={() => router.push('/classes')} className="text-slate-500 hover:text-slate-800 mb-4 flex items-center">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Classes
          </button>
          <h1 className="text-3xl font-bold text-slate-900">{clazz.class_name}</h1>
          <div className="text-slate-600 mt-1">
            <span>Campus: {clazz.campus || '-'}</span>
            <span className="mx-2">•</span>
            <span>Days: {daysText || '-'}</span>
            <span className="mx-2">•</span>
            <span>Time: {timeText || '-'}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Quick Add by Book</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <input
                type="text"
                placeholder="Search books..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full rounded-lg border-gray-300 p-2.5"
              />
            </div>
            <div className="divide-y divide-slate-100 max-h-[240px] overflow-y-auto">
              {filteredBooks.map(b => (
                <div key={b.id} className="flex items-center justify-between py-2">
                  <div className="text-sm text-slate-900">{b.name}</div>
                  <button
                    onClick={() => {
                      setNewCourse({
                        book_id: b.id,
                        total_sessions: b.total_sessions ?? 0,
                      });
                      setAddingCourse(true);
                    }}
                    className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-full hover:bg-slate-800"
                  >
                    Quick Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-10">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Assigned Courses</h2>
            <button
              onClick={() => {
                setAddingCourse(true);
                setNewCourse({ book_id: null, total_sessions: 0 });
              }}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> Add Course
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Section</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Book</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Remaining</th>
                  {[3,4,5,6,7,8,9,10,11,12,1,2].map(m => (
                    <th key={m} className="px-2 py-3 text-center text-[11px] font-semibold text-slate-600">{m}</th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((c, idx) => {
                  const used = Object.values(c.sessions_by_month).reduce((sum, v) => sum + (v || 0), 0);
                  const remaining = (c.total_sessions || 0) - used;
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-3 text-sm">{c.section}</td>
                      <td className="px-4 py-3 text-sm">{c.book.name}</td>
                      <td className="px-4 py-3 text-sm text-center">{c.total_sessions}</td>
                      <td className={`px-4 py-3 text-sm text-center ${remaining < 0 ? 'text-red-600 font-semibold' : ''}`}>{remaining}</td>
                      {[3,4,5,6,7,8,9,10,11,12,1,2].map(m => (
                        <td key={`${c.id}-${m}`} className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            value={c.sessions_by_month[m] ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value || '0', 10);
                              setCourses(prev => {
                                const copy = [...prev];
                                copy[idx] = {
                                  ...copy[idx],
                                  sessions_by_month: { ...copy[idx].sessions_by_month, [m]: val }
                                };
                                return copy;
                              });
                            }}
                            className="w-16 text-sm rounded-lg border-gray-300 px-2 py-1"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/courses/${c.id}/sessions`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sessions_by_month: courses[idx].sessions_by_month }),
                              });
                              if (!res.ok) {
                                alert('Failed to save sessions');
                                return;
                              }
                              const cr = await fetch(`/api/classes/${clazz!.class_id}/courses`);
                              const clist: unknown = await cr.json();
                              if (Array.isArray(clist)) {
                                setCourses(clist as CourseView[]);
                              }
                            }}
                            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700 flex items-center gap-1"
                          >
                            <Save className="h-3 w-3" /> Save
                          </button>
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/courses/${c.id}`, { method: 'DELETE' });
                              if (!res.ok) {
                                alert('Failed to remove course');
                                return;
                              }
                              const cr = await fetch(`/api/classes/${clazz!.class_id}/courses`);
                              const clist: unknown = await cr.json();
                              if (Array.isArray(clist)) {
                                setCourses(clist as CourseView[]);
                              }
                            }}
                            className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-10">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Month Plan Generator</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Month</label>
                <select value={genMonth} onChange={(e) => { setGenMonth(parseInt(e.target.value, 10)); setGenResult([]); }} className="rounded-lg border-gray-300 p-2.5">
                  {[3,4,5,6,7,8,9,10,11,12,1,2].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Sessions</label>
                <input type="number" min={0} value={genTotal} onChange={(e)=>{ setGenTotal(parseInt(e.target.value||'0',10)); setGenResult([]); }} className="rounded-lg border-gray-300 p-2.5 w-28" />
              </div>
              {(() => {
                const sumRemaining = courses.reduce((sum, c) => sum + (c.remaining_sessions || 0), 0);
                const underUtil = genResult.length > 0 && genTotal < sumRemaining;
                const shortage = genResult.length > 0 && genTotal > sumRemaining;
                const anyZero = genResult.length > 0 && genResult.some(r => r.used_sessions === 0);
                return (
                  <div className="flex items-center gap-2">
                    {underUtil && (<span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">총 세션 &lt; 배정 가능</span>)}
                    {shortage && (<span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Remaining 부족</span>)}
                    {anyZero && (<span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700">일부 코스 0 사용</span>)}
                  </div>
                );
              })()}
              <button
                onClick={async () => {
                  if (!clazz) return;
                  const res = await fetch(`/api/classes/${clazz.class_id}/month-plan/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ month: genMonth, total_sessions: genTotal }),
                  });
                  const json: { month: number; total_used: number; plan: Array<{ allocation_id: string; book_id: string; used_sessions: number; remaining_after: number }>; error?: string } = await res.json();
                  if (!res.ok) {
                    alert(json?.error || 'Failed to generate');
                    return;
                  }
                  setGenResult(json.plan || []);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700"
              >
                Generate
              </button>
              <button
                onClick={async () => {
                  if (!clazz || genResult.length === 0) return;
                  const res = await fetch(`/api/classes/${clazz.class_id}/month-plan/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ month: genMonth, plan: genResult.map(r => ({ allocation_id: r.allocation_id, used_sessions: r.used_sessions })) }),
                  });
                  const json: { ok?: boolean; count?: number; error?: string } = await res.json();
                  if (!res.ok) {
                    alert(json?.error || 'Failed to save');
                    return;
                  }
                  const cr = await fetch(`/api/classes/${clazz!.class_id}/courses`);
                  const clist: unknown = await cr.json();
                  if (Array.isArray(clist)) {
                    setCourses(clist as CourseView[]);
                  }
                  alert('Saved month plan');
                }}
                className="bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-800"
              >
                Save
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Book</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Used</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Remaining After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {genResult.map(r => {
                    const course = courses.find(c => c.id === r.allocation_id);
                    const bookName = course?.book.name || r.book_id;
                    return (
                      <tr key={`${r.allocation_id}-${r.book_id}`}>
                        <td className="px-4 py-3 text-sm">{bookName}</td>
                        <td className="px-4 py-3 text-sm text-center">{r.used_sessions}</td>
                        <td className="px-4 py-3 text-sm text-center">{r.remaining_after}</td>
                      </tr>
                    );
                  })}
                  {genResult.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-400" colSpan={3}>No plan generated</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {addingCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-900">Add Course</h3>
                <button onClick={() => setAddingCourse(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Book</label>
                  <select
                    value={newCourse.book_id || ''}
                    onChange={(e) => setNewCourse({ ...newCourse, book_id: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 p-2.5"
                  >
                    <option value="">Select a book</option>
                    {allBooks.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Sessions</label>
                  <input
                    type="number"
                    min={0}
                    value={newCourse.total_sessions}
                    onChange={(e) => setNewCourse({ ...newCourse, total_sessions: parseInt(e.target.value || '0', 10) })}
                    className="block w-full rounded-lg border-gray-300 p-2.5"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setAddingCourse(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
                  <button
                    onClick={async () => {
                      if (!clazz || !newCourse.book_id) return;
                      const res = await fetch(`/api/classes/${clazz.class_id}/courses`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          book_id: newCourse.book_id,
                          total_sessions: newCourse.total_sessions,
                        }),
                      });
                      if (!res.ok) {
                        alert('Failed to add course');
                        return;
                      }
                      setAddingCourse(false);
                      const cr = await fetch(`/api/classes/${clazz.class_id}/courses`);
                      const clist: unknown = await cr.json();
                      if (Array.isArray(clist)) {
                        setCourses(clist as CourseView[]);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
                  >
                    Add Course
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
