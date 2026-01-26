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

  const notAllocatedBooks = useMemo(() => {
    const allocatedIds = new Set((clazz?.books || []).map(b => b.book_id).filter(Boolean) as string[]);
    return allBooks.filter(b => !allocatedIds.has(b.id));
  }, [allBooks, clazz]);

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => router.push('/classes')} className="text-slate-500 hover:text-slate-800 mb-4 flex items-center">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Classes
            </button>
            <h1 className="text-3xl font-bold text-slate-900">{clazz.class_name}</h1>
            <p className="text-slate-500">Manage book allocations</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> Add Book
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
              {(clazz.books || []).map((b) => (
                <tr key={`${b.book_id}-${b.allocation_id}`}>
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
                <h3 className="text-lg font-medium text-slate-900">Add Book</h3>
                <button onClick={() => setAdding(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Book</label>
                  <select
                    value={newAlloc.book_id || ''}
                    onChange={(e) => setNewAlloc({ ...newAlloc, book_id: e.target.value })}
                    className="block w-full rounded-lg border-gray-300 p-2.5"
                  >
                    <option value="">Select a book</option>
                    {notAllocatedBooks.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
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
                <div className="flex justify-end gap-2">
                  <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
                  <button onClick={handleAddAllocation} className="px-4 py-2 rounded-lg bg-indigo-600 text-white">Save</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
