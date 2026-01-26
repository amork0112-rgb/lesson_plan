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

  useEffect(() => {
    const rawId = Array.isArray(id) ? id[0] : id;
    const load = async () => {
      const res = await fetch('/api/classes');
      const json: unknown = await res.json();
      const arr = Array.isArray(json) ? (json as ClassView[]) : [];
      const found = arr.find(c => c.class_id === rawId);
      setClazz(found || null);
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
    const res = await fetch('/api/class-book-allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        class_id: clazz.class_id,
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
    const refreshed = await fetch('/api/classes');
    const json = await refreshed.json();
    const arr = Array.isArray(json) ? (json as ClassView[]) : [];
    const found = arr.find(c => c.class_id === clazz?.class_id);
    setClazz(found || null);
  };

  const removeAllocation = async (allocationId?: string) => {
    if (!allocationId) return;
    const res = await fetch(`/api/class-book-allocations/${allocationId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      alert('Failed to remove allocation');
      return;
    }
    const refreshed = await fetch('/api/classes');
    const json = await refreshed.json();
    const arr = Array.isArray(json) ? (json as ClassView[]) : [];
    const found = arr.find(c => c.class_id === clazz?.class_id);
    setClazz(found || null);
  };

  const handleReorder = async (from: number, to: number) => {
    if (!clazz) return;
    const list = [...clazz.books];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const orderedIds = list.map((b) => b.allocation_id!).filter(Boolean);
    setClazz({ ...clazz, books: list.map((b, i) => ({ ...b, priority: i + 1 })) });
    const res = await fetch('/api/class-book-allocations/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: clazz.class_id, ordered_ids: orderedIds }),
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
      </div>
    </div>
  );
}
