'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/context/store';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Holiday } from '@/types';

interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  source: 'academic' | 'special';
  kind: 'holiday' | 'vacation' | 'no_class' | 'makeup' | 'event';
  sessions?: number;
  class_scope?: string;
  affected_classes?: string[];
  original: any;
}

export default function CalendarPage() {
  const { holidays, deleteHoliday, classes, specialDates, updateSpecialDate } = useData();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [newHoliday, setNewHoliday] = useState<Partial<Holiday> & { dbType?: string }>({ 
      name: '', 
      date: '', 
      type: 'custom', 
      affected_classes: [], 
      dbType: '공휴일', 
      sessions: 0 
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<'academic' | 'special' | null>(null);
  const [originalDate, setOriginalDate] = useState<string | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const startDay = getDay(monthStart); // 0 (Sun) to 6 (Sat)
  const emptyDays = Array(startDay).fill(null);

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // 1. Unified Calendar Event Logic
  const calendarEvents = useMemo(() => {
      const events: CalendarEvent[] = [];

      // A. Expand Academic Calendar (Holidays & Vacations)
      // holidays comes from API which currently returns { ...h, date, original_type, type: 'public_holiday' }
    // Academic Calendar mapping FIX
    holidays.forEach(h => {
      const raw = h as any;

      const sDate = new Date(raw.start_date);
      const eDate = new Date(raw.end_date);

      eachDayOfInterval({ start: sDate, end: eDate }).forEach(d => {
        events.push({
          id: h.id,
          date: format(d, 'yyyy-MM-dd'),
          name: raw.title,             
          source: 'academic',
          kind: raw.type === '방학' ? 'vacation' : 'holiday',
          class_scope: raw.class_name ?? 'all',
          original: h
        });
      });
    });

      // B. Map Special Dates
      Object.entries(specialDates).forEach(([dateStr, special]) => {
          let kind: CalendarEvent['kind'] = 'event';
          if (special.type === 'no_class') kind = 'no_class';
          if (special.type === 'makeup') kind = 'makeup';
          if (special.type === 'school_event') kind = 'event';

          events.push({
              id: `special_${dateStr}`, // Virtual ID
              date: dateStr,
              name: special.name,
              source: 'special',
              kind,
              sessions: special.sessions,
              affected_classes: special.classes || [],
              original: special
          });
      });

      return events;
  }, [holidays, specialDates]);

  const getEventsForDate = (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return calendarEvents.filter(e => e.date === dateStr);
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) return;
    
    const dateStr = newHoliday.date;

    // Check type to decide where to save
    const isAcademic = ['공휴일', '방학'].includes(newHoliday.dbType || '');

    if (isAcademic) {
        // If we were editing a special date and switched to academic, delete the special date
        if (editingId && editingSource === 'special') {
             const target = originalDate || dateStr;
             await updateSpecialDate(target, null);
        }
        
        // Prepare payload for addHoliday (store -> API)
        const payload: any = {
            name: newHoliday.name,
            date: newHoliday.date,
            type: newHoliday.dbType, // '공휴일' or '방학'
            affected_classes: newHoliday.affected_classes,
            sessions: newHoliday.sessions
        };
        
        // If editing an academic calendar entry, delete first
        if (editingId && editingSource === 'academic') {
            await deleteHoliday(editingId);
        }
        
        await (window as any).fetch('/api/calendar/holidays', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(() => {
            window.location.reload(); 
        });

    } else {
        // Special Date (No Class, Makeup, Event)
        let type = 'school_event';
        if (newHoliday.dbType === '휴강') type = 'no_class';
        if (newHoliday.dbType === '보강') type = 'makeup';
        
        const data = {
            type,
            name: newHoliday.name,
            sessions: newHoliday.sessions || 0,
            classes: (newHoliday.affected_classes && newHoliday.affected_classes.length > 0) 
                      ? newHoliday.affected_classes 
                      : null
        };
        
        if (editingId && editingSource === 'academic') {
            await deleteHoliday(editingId);
        }

        // If date changed for special date, delete old one
        if (editingSource === 'special' && originalDate && originalDate !== dateStr) {
            await updateSpecialDate(originalDate, null);
        }
        
        await updateSpecialDate(dateStr, data as any);
    }
    
    resetForm();
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    if (editingSource === 'academic' && editingId) {
        await deleteHoliday(editingId);
    } else {
        // Special Date (delete by date)
        const targetDate = originalDate || newHoliday.date;
        if (targetDate) await updateSpecialDate(targetDate, null);
    }
    resetForm();
  };

  const resetForm = () => {
      setIsAdding(false);
      setEditingId(null);
      setEditingSource(null);
      setOriginalDate(null);
      setNewHoliday({ name: '', date: '', type: 'custom', affected_classes: [], sessions: 0, dbType: '공휴일' });
  };

  const toggleClassSelection = (classId: string) => {
    const current = newHoliday.affected_classes || [];
    if (current.includes(classId)) {
        setNewHoliday({ ...newHoliday, affected_classes: current.filter(id => id !== classId) });
    } else {
        setNewHoliday({ ...newHoliday, affected_classes: [...current, classId] });
    }
  };

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setNewHoliday({
        name: '',
        date: dateStr,
        type: 'custom',
        affected_classes: [],
        dbType: '공휴일',
        sessions: 0
    });
    setEditingId(null);
    setEditingSource(null);
    setIsAdding(true);
  };

  const handleEditEvent = (e: React.MouseEvent, event: CalendarEvent) => {
      e.stopPropagation();
      
      let dbType = '공휴일';
      if (event.kind === 'vacation') dbType = '방학';
      if (event.kind === 'no_class') dbType = '휴강';
      if (event.kind === 'makeup') dbType = '보강';
      if (event.kind === 'event') dbType = '행사';

      // For academic calendar, we need to fetch the original row to get 'class_scope' if it's not in event
      // But event.original has it.
      
      let affected_classes: string[] = [];
      if (event.source === 'special') {
          affected_classes = event.affected_classes || [];
      } else {
          // Academic
          const scope = event.class_scope || (event.original as any).class_scope;
          if (scope && scope !== 'all') {
              affected_classes = [scope];
          }
      }

      setNewHoliday({
          name: event.name,
          date: event.date, // Use the clicked date (even if part of range, we edit this instance effectively? No, editing usually edits the source)
          // If we edit a range item, we probably should edit the whole range?
          // For now, let's just populate the date.
          type: 'custom',
          affected_classes,
          dbType,
          sessions: event.sessions || 0
      });
      
      setEditingId(event.id);
      setEditingSource(event.source);
      setOriginalDate(event.date);
      setIsAdding(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Calendar & Events</h1>
            <p className="text-slate-500 text-sm">Manage holidays, vacations, and class events.</p>
          </div>
          <div className="flex gap-3">
             <div className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 mr-2">
                 <span className="w-2 h-2 rounded-full bg-blue-400"></span> Click date to toggle Events
             </div>
             <button 
               onClick={() => setIsAdding(!isAdding)}
               className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors shadow-sm"
             >
               <Plus className="h-4 w-4" /> Add events
             </button>
          </div>
        </div>

        {isAdding && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-sm font-bold text-slate-900 mb-4">{editingId ? 'Edit Event' : 'Add New Event'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
               <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Name</label>
                  <input 
                    value={newHoliday.name}
                    onChange={e => setNewHoliday({...newHoliday, name: e.target.value})}
                    placeholder="e.g. Chuseok"
                    className="w-full border-b border-slate-200 py-1.5 focus:border-slate-900 focus:outline-none"
                  />
               </div>
               <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Date</label>
                  <input 
                    type="date"
                    value={newHoliday.date}
                    onChange={e => setNewHoliday({...newHoliday, date: e.target.value})}
                    className="w-full border-b border-slate-200 py-1.5 focus:border-slate-900 focus:outline-none"
                  />
               </div>
               <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Type</label>
                  <select 
                    value={newHoliday.dbType || '공휴일'}
                    onChange={e => setNewHoliday({...newHoliday, dbType: e.target.value})}
                    className="w-full border-b border-slate-200 py-1.5 focus:border-slate-900 focus:outline-none bg-transparent"
                  >
                    <optgroup label="Academic Calendar (Global)">
                        <option value="공휴일">Holiday (공휴일)</option>
                        <option value="방학">Vacation (방학)</option>
                    </optgroup>
                    <optgroup label="Special Dates (Class Specific)">
                        <option value="행사">School Event (행사)</option>
                        <option value="휴강">No Class (휴강)</option>
                        <option value="보강">Makeup Class (보강)</option>
                    </optgroup>
                  </select>
               </div>
               <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Sessions</label>
                  <input 
                    type="number"
                    min="0"
                    value={newHoliday.sessions || 0}
                    onChange={e => setNewHoliday({...newHoliday, sessions: parseInt(e.target.value) || 0})}
                    className="w-full border-b border-slate-200 py-1.5 focus:border-slate-900 focus:outline-none"
                  />
               </div>
            </div>
            
            <div className="mb-4">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Affected Classes (Optional)</label>
                <div className="flex flex-wrap gap-2">
                    {classes.map(cls => (
                        <button 
                            key={cls.id}
                            onClick={() => toggleClassSelection(cls.id)}
                            className={cn(
                                "px-3 py-1 text-xs rounded-full border transition-colors",
                                (newHoliday.affected_classes || []).includes(cls.id)
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            )}
                        >
                            {cls.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
               {editingId ? (
                   <button 
                     onClick={handleDelete}
                     className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-2 transition-colors"
                   >
                     <Trash2 className="h-4 w-4" /> Delete
                   </button>
               ) : (
                   <div></div>
               )}
               <div className="flex gap-2">
                   <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                   <button onClick={handleAddHoliday} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 transition-colors">Save</button>
               </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow border border-gray-200 flex-1 flex flex-col">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full">
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full">
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-gray-200 gap-px">
            {emptyDays.map((_, i) => (
              <div key={`empty-${i}`} className="bg-white" />
            ))}
            
            {daysInMonth.map((date) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const events = getEventsForDate(date);
              const isToday = isSameDay(date, new Date());
              
              const isSunday = date.getDay() === 0;
              // Check if any event is a holiday or vacation
              const isHoliday = events.some(e => e.kind === 'holiday');
              const isVacation = events.some(e => e.kind === 'vacation');
              const isRedDay = isHoliday || isSunday;
              
              return (
                <div 
                    key={date.toString()} 
                    onClick={() => handleDateClick(date)}
                    className={cn(
                        "bg-white p-2 min-h-[100px] flex flex-col hover:bg-gray-50 transition-colors cursor-pointer", 
                        isToday && "bg-indigo-50/30",
                        isVacation && "bg-amber-50/30"
                    )}
                >
                  <div className="flex justify-between items-start">
                    <span className={cn(
                      "text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full",
                      isToday 
                        ? "bg-indigo-600 text-white" 
                        : isRedDay ? "text-red-600" : "text-gray-700"
                    )}>
                      {format(date, 'd')}
                    </span>
                  </div>
                  
                  <div className="mt-2 space-y-1 flex-1 overflow-y-auto max-h-[120px]">
                    {events.map(event => {
                        // Determine style based on kind
                        let style = "bg-blue-100 border-blue-200 text-blue-700"; // default event
                        if (event.kind === 'holiday') style = "bg-red-50 text-red-900 border-red-100";
                        if (event.kind === 'vacation') style = "bg-amber-100 text-amber-900 border-amber-200";
                        if (event.kind === 'no_class') style = "bg-rose-100 border-rose-200 text-rose-700";
                        if (event.kind === 'makeup') style = "bg-green-100 border-green-200 text-green-700";

                        // Subtext for affected classes
                        let subText = "All Classes";
                        if (event.affected_classes && event.affected_classes.length > 0) {
                             subText = event.affected_classes
                                .map(cid => classes.find(c => c.id === cid)?.name || cid)
                                .join(', ');
                        } else if (event.class_scope && event.class_scope !== 'all') {
                             subText = event.class_scope;
                        }

                        return (
                            <div 
                                key={`${event.id}-${event.source}`}
                                onClick={(e) => handleEditEvent(e, event)}
                                className={cn(
                                    "group flex flex-col gap-0.5 px-2 py-1.5 rounded border text-xs mb-1 cursor-pointer hover:shadow-sm transition-shadow",
                                    style
                                )}
                            >
                                <div className="flex justify-between items-start">
                                   <span className="font-bold truncate">{event.name}</span>
                                </div>
                                <div className="text-[10px] leading-tight opacity-75">
                                   {subText}
                                </div>
                                {event.kind !== 'holiday' && event.kind !== 'vacation' && (
                                     <div className="text-[9px] opacity-60 uppercase tracking-tighter mt-0.5">
                                         {event.kind.replace('_', ' ')}
                                     </div>
                                )}
                            </div>
                        );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
