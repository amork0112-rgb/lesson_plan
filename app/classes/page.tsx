'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Plus, Trash2, Search } from 'lucide-react';
import { Class, Weekday } from '@/types';

const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_MAP: Record<Weekday, string> = { Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토', Sun: '일' };
function to12h(time?: string | null) {
  if (!time) return '';
  const [hh, mm] = time.split(':');
  const h = parseInt(hh, 10);
  const twelve = ((h % 12) || 12).toString();
  return `${twelve}:${mm}`;
}
function formatDays(days: Weekday[]) {
  return days.map(d => DAY_MAP[d]).join('');
}

export default function ClassesPage() {
  const supabase = getSupabase();
  const [classes, setClasses] = useState<Class[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // New Class State
  const [newClass, setNewClass] = useState<Partial<Class>>({
    name: '',
    year: 2026,
    level_group: 'Elementary',
    start_time: '14:00',
    end_time: '15:30',
    dismissal_time: '',
    days: ['Mon', 'Wed', 'Fri'],
    scp_type: null
  });

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const fetchAll = async () => {
      const res = await fetch('/api/classes');
      const json: unknown = await res.json();
      if (Array.isArray(json)) {
        const simple = json.map((c) => ({ id: (c as { id: string }).id, name: (c as { name: string }).name }));
        setClasses(simple as unknown as Class[]);
      }
    };
    fetchAll();
  }, []);

  const handleEdit = (cls: Class) => {
    setNewClass({ ...cls });
    setEditingId(cls.id);
    setIsAdding(true);
  };

  const handleSave = () => {
    if (!newClass.name) return;
    
    const upsert = async () => {
      if (!supabase) return;
      if (editingId) {
        await supabase
          .from('classes')
          .update({
            name: newClass.name,
            year: newClass.year,
            level_group: newClass.level_group,
            start_time: newClass.start_time,
            end_time: newClass.end_time,
            dismissal_time: newClass.dismissal_time,
            days: newClass.days,
            scp_type: newClass.scp_type ?? null
          })
          .eq('id', editingId);
      } else {
        const { data } = await supabase.from('classes').insert({
          name: newClass.name,
          year: newClass.year || 2026,
          level_group: newClass.level_group || 'Elementary',
          start_time: newClass.start_time || '14:00',
          end_time: newClass.end_time || '15:30',
          dismissal_time: newClass.dismissal_time || null,
          days: newClass.days || [],
          scp_type: newClass.scp_type ?? null
        }).select('*');
        if (Array.isArray(data)) {
          const combined = [...classes, ...(data as Class[])].sort((a, b) => a.name.localeCompare(b.name));
          setClasses(combined);
        }
      }
      const { data: cls } = await supabase.from('classes').select('*').order('name', { ascending: true });
      if (Array.isArray(cls)) setClasses(cls as Class[]);
    };
    upsert();
    
    setIsAdding(false);
    setEditingId(null);
    setNewClass({
      name: '',
      year: 2026,
      level_group: 'Elementary',
      start_time: '14:00',
      end_time: '15:30',
      dismissal_time: '',
      days: ['Mon', 'Wed', 'Fri'],
      scp_type: null
    });
  };

  const toggleDay = (day: Weekday) => {
    const currentDays = newClass.days || [];
    if (currentDays.includes(day)) {
      setNewClass({ ...newClass, days: currentDays.filter(d => d !== day) });
    } else {
      setNewClass({ ...newClass, days: [...currentDays, day] });
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!supabase) return;
    await supabase.from('classes').delete().eq('id', id);
    const { data: cls } = await supabase.from('classes').select('*').order('name', { ascending: true });
    if (Array.isArray(cls)) setClasses(cls as Class[]);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-light text-slate-900 tracking-tight mb-2">Class Management</h1>
            <p className="text-slate-500 font-light">Manage classes and their schedules.</p>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="group flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" /> 
            <span className="text-sm font-medium">New Class</span>
          </button>
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

        {/* Add Modal / Inline Form */}
        {isAdding && (
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-100 border border-slate-100 mb-10 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-lg font-medium text-slate-900 mb-6">Add New Class</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Class Name</label>
                <input
                  placeholder="e.g. Elementary A"
                  value={newClass.name}
                  onChange={e => setNewClass({...newClass, name: e.target.value})}
                  className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Year</label>
                <input
                  type="number"
                  value={newClass.year}
                  onChange={e => setNewClass({...newClass, year: parseInt(e.target.value)})}
                  className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Level Group</label>
                <select
                  value={newClass.level_group}
                  onChange={e => setNewClass({...newClass, level_group: e.target.value})}
                  className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent transition-colors"
                >
                  <option value="Elementary">Elementary</option>
                  <option value="Middle">Middle</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Time</label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <span className="text-[10px] text-gray-400 block mb-1">Start</span>
                    <input
                      type="time"
                      value={newClass.start_time}
                      onChange={e => setNewClass({...newClass, start_time: e.target.value})}
                      className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] text-gray-400 block mb-1">End</span>
                    <input
                      type="time"
                      value={newClass.end_time}
                      onChange={e => setNewClass({...newClass, end_time: e.target.value})}
                      className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] text-gray-400 block mb-1">Dismissal</span>
                    <input
                      type="time"
                      value={newClass.dismissal_time}
                      onChange={e => setNewClass({...newClass, dismissal_time: e.target.value})}
                      className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-8">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">Schedule Days</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(day => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      newClass.days?.includes(day)
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-8">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">SCP Type (Optional)</label>
              <select
                value={newClass.scp_type ?? ''}
                onChange={e => setNewClass({...newClass, scp_type: e.target.value ? e.target.value as Class['scp_type'] : null})}
                className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent transition-colors"
              >
                <option value="">None</option>
                <option value="red">Red</option>
                <option value="orange">Orange</option>
                <option value="yellow">Yellow</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  setNewClass({
                    name: '',
                    year: 2026,
                    level_group: 'Elementary',
                    weekly_sessions: 3,
                    start_time: '14:00',
                    end_time: '15:30',
                    dismissal_time: '',
                    days: ['Mon', 'Wed', 'Fri']
                  });
                }}
                className="px-6 py-2 text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
              >
                {editingId ? 'Update Class' : 'Save Class'}
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="px-6 py-4">Class Name</th>
                <th className="px-6 py-4 w-40">Days</th>
                <th className="px-6 py-4 w-56">Class Time</th>
                <th className="px-6 py-4 w-40">Dismissal</th>
                <th className="px-6 py-4 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredClasses.map((cls) => (
                <tr
                  key={cls.id}
                  onClick={() => handleEdit(cls)}
                  className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 group-hover:text-indigo-900 transition-colors">{cls.name}</div>
                    <div className="text-xs text-slate-500">{cls.level_group} • {cls.year}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700">{formatDays(cls.days || [])}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-700">
                      {to12h(cls.start_time)} ~ {to12h(cls.end_time)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700">{cls.dismissal_time ? to12h(cls.dismissal_time) : '-'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(cls.id); }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete Class"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
