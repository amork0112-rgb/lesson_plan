'use client';

import { useState } from 'react';
import { useData } from '@/context/store';
import { Plus, Trash2, Search, Users, Clock, Calendar } from 'lucide-react';
import { Class, Weekday } from '@/types';

const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ClassesPage() {
  const { classes, addClass, updateClass, deleteClass } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // New Class State
  const [newClass, setNewClass] = useState<Partial<Class>>({
    name: '',
    year: 2026,
    level_group: 'Elementary',
    weekly_sessions: 3,
    start_time: '14:00',
    end_time: '15:30',
    dismissal_time: '',
    days: ['Mon', 'Wed', 'Fri']
  });

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (cls: Class) => {
    setNewClass({ ...cls });
    setEditingId(cls.id);
    setIsAdding(true);
  };

  const handleSave = () => {
    if (!newClass.name) return;
    
    if (editingId) {
      updateClass(editingId, {
        name: newClass.name,
        year: newClass.year,
        level_group: newClass.level_group,
        weekly_sessions: newClass.days?.length || 0,
        start_time: newClass.start_time,
        end_time: newClass.end_time,
        dismissal_time: newClass.dismissal_time,
        days: newClass.days
      });
    } else {
      addClass({
        id: `cl_${Math.random().toString(36).substr(2, 9)}`,
        name: newClass.name,
        year: newClass.year || 2026,
        level_group: newClass.level_group || 'Elementary',
        weekly_sessions: newClass.days?.length || 0,
        start_time: newClass.start_time || '14:00',
        end_time: newClass.end_time || '15:30',
        dismissal_time: newClass.dismissal_time,
        days: newClass.days || []
      } as Class);
    }
    
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
  };

  const toggleDay = (day: Weekday) => {
    const currentDays = newClass.days || [];
    if (currentDays.includes(day)) {
      setNewClass({ ...newClass, days: currentDays.filter(d => d !== day) });
    } else {
      setNewClass({ ...newClass, days: [...currentDays, day] });
    }
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

        {/* Class List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClasses.map((cls) => (
            <div key={cls.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group relative">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{cls.name}</h3>
                    <p className="text-xs text-slate-500">{cls.level_group} • {cls.year}</p>
                  </div>
                </div>
                <div className="flex gap-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEdit(cls)}
                    className="text-slate-300 hover:text-indigo-500 transition-colors p-1 hover:bg-indigo-50 rounded-full"
                    title="Edit Class"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  </button>
                  <button 
                    onClick={() => deleteClass(cls.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded-full"
                    title="Delete Class"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <div className="flex gap-1">
                    {cls.days.map(d => (
                      <span key={d} className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-medium text-slate-600">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>{cls.start_time} - {cls.end_time}</span>
                  {cls.dismissal_time && (
                    <span className="text-xs text-orange-500 font-medium ml-2">
                       (Out: {cls.dismissal_time})
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
