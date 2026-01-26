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

export default function ClassDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [clazz, setClazz] = useState<ClassView | null>(null);
  const [allBooks, setAllBooks] = useState<BookLite[]>([]);
  const [adding, setAdding] = useState<boolean>(false);
  const [newAlloc, setNewAlloc] = useState<{ book_id?: string; priority: number; sessions_per_week: number }>({
    book_id: undefined,
    priority: 1,
    sessions_per_week: 1,
  });
  const [notes, setNotes] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [courses, setCourses] = useState<Array<{
    id: string;
    section: string;
    book: { id: string; name: string };
    is_secondary: boolean;
    total_sessions: number;
    remaining_sessions: number;
    sessions_by_month: Record<number, number>;
  }>>([]);
  const [addingCourse, setAddingCourse] = useState<boolean>(false);
  const [newCourse, setNewCourse] = useState<{ section: string; book_id: string | null; is_secondary: boolean; total_sessions: number }>({
    section: 'Reading',
    book_id: null,
    is_secondary: false,
    total_sessions: 0,
  });

  useEffect(() => {
    const rawId = Array.isArray(id) ? id[0] : id;
    const load = async () => {
      const res = await fetch('/api/classes');
      const json: unknown = await res.json();
      const arr = Array.isArray(json) ? (json as ClassView[]) : [];
      const found = arr.find(c => c.class_id === rawId);
      setClazz(found || null);
      if (found) {
        const ar = await fetch(`/api/classes/${found.class_id}/books`);
        const list: unknown = await ar.json();
        if (Array.isArray(list)) {
          type AssignedResp = {
            allocation_id: string;
            priority: number;
            sessions_per_week: number;
            book: { id: string; name: string; total_sessions: number };
          };
          const books = (list as unknown as AssignedResp[]).map((r) => ({
            allocation_id: r.allocation_id,
            book_id: r.book.id,
            book_name: r.book.name,
            priority: r.priority,
            sessions_per_week: r.sessions_per_week,
            total_sessions: r.book.total_sessions ?? 0,
          }));
          setClazz(prev => prev ? { ...prev, books } : prev);
        }
        const cr = await fetch(`/api/classes/${found.class_id}/courses`);
        const clist: unknown = await cr.json();
        if (Array.isArray(clist)) {
          setCourses(clist as any);
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

  const allocatedIds = useMemo(() => new Set((clazz?.books || []).map(b => b.book_id).filter(Boolean) as string[]), [clazz]);
  const filteredBooks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = term ? allBooks.filter(b => b.name.toLowerCase().includes(term)) : allBooks;
    return list;
  }, [allBooks, searchTerm]);
  const maxPriority = useMemo(() => {
    const arr = (clazz?.books || []).map(b => b.priority || 0);
    return arr.length ? Math.max(...arr) : 0;
  }, [clazz]);

  const handleAddAllocation = async () => {
    if (!clazz || !newAlloc.book_id) return;
    const res = await fetch(`/api/classes/${clazz.class_id}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        book_id: newAlloc.book_id,
        priority: newAlloc.priority,
        sessions_per_week: newAlloc.sessions_per_week,
      }),
    });
    if (!res.ok) {
      alert('Failed to add allocation');
      return;
    }
    setAdding(false);
    setNewAlloc({ book_id: undefined, priority: 1, sessions_per_week: 1 });
    setNotes('');
    setSearchTerm('');
    const refreshed = await fetch('/api/classes');
    const json = await refreshed.json();
    const arr = Array.isArray(json) ? (json as ClassView[]) : [];
    const found = arr.find(c => c.class_id === clazz.class_id);
    setClazz(found || null);
  };

  const updateAllocation = async (allocationId: string, payload: { priority?: number; sessions_per_week?: number }) => {
    const res = await fetch(`/api/class-book-allocations/${allocationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      alert('Failed to update allocation');
      return;
    }
    const refreshed = await fetch(`/api/classes/${clazz!.class_id}/books`);
    const list: unknown = await refreshed.json();
    if (Array.isArray(list)) {
      type AssignedResp = {
        allocation_id: string;
        priority: number;
        sessions_per_week: number;
        book: { id: string; name: string; total_sessions: number };
      };
      const books = (list as unknown as AssignedResp[]).map((r) => ({
        allocation_id: r.allocation_id,
        book_id: r.book.id,
        book_name: r.book.name,
        priority: r.priority,
        sessions_per_week: r.sessions_per_week,
        total_sessions: r.book.total_sessions ?? 0,
      }));
      setClazz(prev => prev ? { ...prev, books } : prev);
    }
  };

  const removeAllocation = async (allocationId?: string) => {
    if (!allocationId) return;
    const res = await fetch(`/api/classes/${clazz!.class_id}/books/${allocationId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      alert('Failed to remove allocation');
      return;
    }
    const refreshed = await fetch(`/api/classes/${clazz!.class_id}/books`);
    const list: unknown = await refreshed.json();
    if (Array.isArray(list)) {
      type AssignedResp = {
        allocation_id: string;
        priority: number;
        sessions_per_week: number;
        book: { id: string; name: string; total_sessions: number };
      };
      const books = (list as unknown as AssignedResp[]).map((r) => ({
        allocation_id: r.allocation_id,
        book_id: r.book.id,
        book_name: r.book.name,
        priority: r.priority,
        sessions_per_week: r.sessions_per_week,
        total_sessions: r.book.total_sessions ?? 0,
      }));
      setClazz(prev => prev ? { ...prev, books } : prev);
    }
  };

  const handleReorder = async (from: number, to: number) => {
    if (!clazz) return;
    const list = [...clazz.books];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const orders = list.map((b, i) => ({ allocation_id: b.allocation_id!, priority: i + 1 }));
    setClazz({ ...clazz, books: list.map((b, i) => ({ ...b, priority: i + 1 })) });
    const res = await fetch('/api/class-book-allocations/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: clazz.class_id, orders }),
    });
    if (!res.ok) {
      alert('Failed to reorder');
    }
  };

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
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Assigned Books</h2>
            <button
              onClick={() => {
                setNewAlloc({ book_id: undefined, priority: maxPriority + 1, sessions_per_week: 1 });
                setNotes('');
                setSearchTerm('');
                setAdding(true);
              }}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> Add Book
            </button>
          </div>
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Book</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sessions/Week</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {(clazz.books || []).map((b, idx) => (
                <tr
                  key={`${b.book_id}-${b.allocation_id}`}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex === null || dragIndex === idx) return;
                    handleReorder(dragIndex, idx);
                    setDragIndex(null);
                  }}
                  className="cursor-move"
                >
                  <td className="px-6 py-3 text-sm text-slate-900">{b.book_name}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={b.priority ?? 1}
                        onChange={(e) => {
                          const next = { ...b, priority: parseInt(e.target.value || '1', 10) };
                          setClazz(prev => prev ? { ...prev, books: prev.books.map(x => x.allocation_id === b.allocation_id ? next : x) } : prev);
                        }}
                        className="w-20 rounded-lg border-gray-300"
                      />
                      <button
                        onClick={() => updateAllocation(b.allocation_id!, { priority: b.priority })}
                        className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700 flex items-center gap-1"
                      >
                        <Save className="h-3 w-3" /> Save
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={b.sessions_per_week ?? 1}
                        onChange={(e) => {
                          const next = { ...b, sessions_per_week: parseInt(e.target.value || '1', 10) };
                          setClazz(prev => prev ? { ...prev, books: prev.books.map(x => x.allocation_id === b.allocation_id ? next : x) } : prev);
                        }}
                        className="w-28 rounded-lg border-gray-300"
                      />
                      <button
                        onClick={() => updateAllocation(b.allocation_id!, { sessions_per_week: b.sessions_per_week })}
                        className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700 flex items-center gap-1"
                      >
                        <Save className="h-3 w-3" /> Save
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => removeAllocation(b.allocation_id)}
                      className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-10">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Assigned Courses</h2>
            <button
              onClick={() => {
                setAddingCourse(true);
                setNewCourse({ section: 'Reading', book_id: null, is_secondary: false, total_sessions: 0 });
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
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Secondary</th>
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
                      <td className="px-4 py-3 text-sm text-center">{c.is_secondary ? 'Yes' : 'No'}</td>
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
                              const months = [3,4,5,6,7,8,9,10,11,12,1,2];
                              for (const m of months) {
                                const v = courses[idx].sessions_by_month[m] ?? 0;
                                const res = await fetch(`/api/courses/${c.id}/sessions`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ month: m, sessions: v }),
                                });
                                if (!res.ok) {
                                  alert('Failed to save sessions');
                                  return;
                                }
                              }
                              const cr = await fetch(`/api/classes/${clazz!.class_id}/courses`);
                              const clist: unknown = await cr.json();
                              if (Array.isArray(clist)) {
                                setCourses(clist as any);
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
                                setCourses(clist as any);
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

        {adding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-900">Add Book to This Class</h3>
                <button onClick={() => setAdding(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Book</label>
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="Search books..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full rounded-lg border-gray-300 p-2.5"
                    />
                  </div>
                  <select
                    value={newAlloc.book_id || ''}
                    onChange={(e) => setNewAlloc({ ...newAlloc, book_id: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 p-2.5"
                  >
                    <option value="">Select a book</option>
                    {filteredBooks.map(b => {
                      const disabled = allocatedIds.has(b.id);
                      return (
                        <option key={b.id} value={b.id} disabled={disabled}>
                          {b.name}
                          {disabled ? ' (Assigned)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Priority</label>
                    <input
                      type="number"
                      min={1}
                      value={newAlloc.priority}
                      onChange={(e) => setNewAlloc({ ...newAlloc, priority: parseInt(e.target.value || '1', 10) })}
                      className="block w-full rounded-lg border-gray-300 p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sessions/Week</label>
                    <input
                      type="number"
                      min={1}
                      value={newAlloc.sessions_per_week}
                      onChange={(e) => setNewAlloc({ ...newAlloc, sessions_per_week: parseInt(e.target.value || '1', 10) })}
                      className="block w-full rounded-lg border-gray-300 p-2.5"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="block w-full rounded-lg border-gray-300 p-2.5"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
                  <button onClick={handleAddAllocation} className="px-4 py-2 rounded-lg bg-indigo-600 text-white">Add Book</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {addingCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-900">Add Course</h3>
                <button onClick={() => setAddingCourse(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Section</label>
                  <select
                    value={newCourse.section}
                    onChange={(e) => setNewCourse({ ...newCourse, section: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 p-2.5"
                  >
                    {['Reading','Grammar','Voca','Writing','Activity','Others'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
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
                <div className="flex items-center gap-2">
                  <input
                    id="is_secondary"
                    type="checkbox"
                    checked={newCourse.is_secondary}
                    onChange={(e) => setNewCourse({ ...newCourse, is_secondary: e.target.checked })}
                  />
                  <label htmlFor="is_secondary" className="text-sm text-slate-700">Secondary</label>
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
                          section: newCourse.section,
                          book_id: newCourse.book_id,
                          is_secondary: newCourse.is_secondary,
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
                        setCourses(clist as any);
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
