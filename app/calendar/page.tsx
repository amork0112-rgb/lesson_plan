'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Holiday, Class, SpecialDate } from '@/types';
import { DEFAULT_HOLIDAYS, SAMPLE_CLASSES } from '@/lib/data';

export default function CalendarPage() {
  const [holidays, setHolidays] = useState<Holiday[]>(DEFAULT_HOLIDAYS);
  const [classes] = useState<Class[]>(SAMPLE_CLASSES);
  const [specialDates, setSpecialDates] = useState<Record<string, SpecialDate>>({});
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1)); // Start at Jan 2026
  const [isAdding, setIsAdding] = useState(false);
  const [newHoliday, setNewHoliday] = useState<Partial<Holiday>>({ name: '', date: '', type: 'custom', affected_classes: [] });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Grid padding
  const startDay = getDay(monthStart); // 0 (Sun) to 6 (Sat)
  const emptyDays = Array(startDay).fill(null);

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleAddHoliday = () => {
    if (!newHoliday.name || !newHoliday.date) return;
    const id = `h_local_${newHoliday.date}_${newHoliday.name}`;
    const next: Holiday = {
      id,
      name: newHoliday.name!,
      date: newHoliday.date!,
      type: (newHoliday.type as Holiday['type']) || 'custom',
      year: parseInt(newHoliday.date!.slice(0, 4), 10),
      affected_classes: newHoliday.affected_classes || []
    };
    setHolidays([...holidays, next]);
    setIsAdding(false);
    setNewHoliday({ name: '', date: '', type: 'custom', affected_classes: [] });
  };

  const toggleClassSelection = (classId: string) => {
    const current = newHoliday.affected_classes || [];
    if (current.includes(classId)) {
        setNewHoliday({ ...newHoliday, affected_classes: current.filter(id => id !== classId) });
    } else {
        setNewHoliday({ ...newHoliday, affected_classes: [...current, classId] });
    }
  };

  const getHolidaysForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.filter(h => h.date === dateStr);
  };

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const current = specialDates[dateStr];
    let nextData: SpecialDate | null = null;
    
    if (!current) {
        nextData = { type: 'event', name: 'Event' };
    } else if (current.type === 'event') {
        nextData = { type: 'makeup', name: 'Makeup' };
    } else if (current.type === 'makeup') {
        nextData = { type: 'school_event', name: 'PBL' };
    } else if (current.type === 'school_event') {
        const eventOrder = ['PBL', '정기평가', 'PBL (Tech)', '100Days', 'Vocaton', 'PBL (Econ)'];
        const currentIndex = eventOrder.indexOf(current.name);
        if (currentIndex !== -1 && currentIndex < eventOrder.length - 1) {
             nextData = { type: 'school_event', name: eventOrder[currentIndex + 1] };
        } else {
             nextData = null;
        }
    } else {
        nextData = null;
    }
    if (nextData) {
      setSpecialDates({ ...specialDates, [dateStr]: nextData });
    } else {
      const rest = { ...specialDates };
      delete rest[dateStr];
      setSpecialDates(rest);
    }
  };

  const deleteHolidayById = (id: string) => {
    setHolidays(holidays.filter(h => h.id !== id));
  };

  // Removed all Supabase effects; calendar operates on local state only

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Calendar & Events</h1>
            <p className="text-slate-500 text-sm">Manage holidays and school events.</p>
          </div>
          <div className="flex gap-3">
             <div className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 mr-2">
                 <span className="w-2 h-2 rounded-full bg-blue-400"></span> Click date to toggle Events
             </div>
             <button 
               onClick={() => setIsAdding(!isAdding)}
               className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors shadow-sm"
             >
               <Plus className="h-4 w-4" /> Add Holiday
             </button>
          </div>
        </div>

        {isAdding && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Add New Holiday</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Affected Classes</label>
                  <div className="text-xs text-slate-400 py-2">Select below (Default: All)</div>
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

            <div className="flex justify-end gap-2 mt-2">
               <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
               <button onClick={handleAddHoliday} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">Save Event</button>
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
              const dateHolidays = getHolidaysForDate(date);
              const special = specialDates[format(date, 'yyyy-MM-dd')];
              const isToday = isSameDay(date, new Date());
              const hasNationalHoliday = dateHolidays.some(h => h.type === 'national');
              const isSunday = date.getDay() === 0;
              const isRedDay = hasNationalHoliday || isSunday;
              
              return (
                <div 
                    key={date.toString()} 
                    onClick={() => handleDateClick(date)}
                    className={cn(
                        "bg-white p-2 min-h-[100px] flex flex-col hover:bg-gray-50 transition-colors cursor-pointer", 
                        isToday && "bg-indigo-50/30",
                        special && "bg-slate-50"
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
                    {/* Render Special Dates First */}
                    {special && (
                        <div className={cn(
                            "group flex flex-col gap-0.5 px-2 py-1.5 rounded border text-xs mb-1",
                            special.type === 'event' ? "bg-red-100 border-red-200 text-red-700" :
                            special.type === 'makeup' ? "bg-green-100 border-green-200 text-green-700" :
                            "bg-blue-100 border-blue-200 text-blue-700"
                        )}>
                            <div className="flex justify-between items-start">
                               <span className="font-bold truncate">{special.name}</span>
                            </div>
                            <div className="text-[10px] leading-tight opacity-75 uppercase">
                               {special.type === 'school_event' ? 'School Event' : special.type}
                            </div>
                        </div>
                    )}

                    {/* Render Holidays */}
                    {dateHolidays.map(h => {
                      // Find class names if specific classes are affected
                      let classNames = '';
                      if (h.affected_classes && h.affected_classes.length > 0) {
                          classNames = h.affected_classes
                              .map(cid => classes.find(c => c.id === cid)?.name || cid)
                              .join(', ');
                      }

                      const isNational = h.type === 'national';
                      const itemStyle = isNational 
                          ? "bg-red-50 text-red-900 border-red-100" 
                          : "bg-amber-50 text-amber-900 border-amber-100";
                      const subTextStyle = isNational
                          ? "text-red-600"
                          : classNames ? "text-amber-600" : "text-gray-500";

                      return (
                        <div 
                          key={h.id} 
                          className={cn("group flex flex-col gap-0.5 px-2 py-1.5 rounded border text-xs mb-1", itemStyle)}
                          onClick={(e) => e.stopPropagation()} 
                        >
                          <div className="flex justify-between items-start">
                              <span className="font-semibold truncate">{h.name}</span>
                              <button 
                                  onClick={(e) => { e.stopPropagation(); deleteHolidayById(h.id); }}
                                  className="hidden group-hover:block hover:opacity-75 ml-1"
                              >
                                  <Trash2 className="h-3 w-3" />
                              </button>
                          </div>
                          {classNames && (
                              <div className={cn("text-[10px] leading-tight", subTextStyle)}>
                                  {classNames}
                              </div>
                          )}
                          {!classNames && (
                              <div className={cn("text-[10px] leading-tight", subTextStyle)}>
                                  All Classes
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
