'use client';

import { useState } from 'react';
import { useData } from '@/context/store';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Holiday } from '@/types';

export default function CalendarPage() {
  const { holidays, addHoliday, deleteHoliday, classes } = useData();
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
    addHoliday({
      id: Math.random().toString(),
      name: newHoliday.name,
      date: newHoliday.date,
      type: 'custom',
      year: parseInt(newHoliday.date.split('-')[0]),
      affected_classes: newHoliday.affected_classes
    });
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

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Academic Calendar</h1>
          <p className="text-gray-500">View and manage holidays and events.</p>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Event
          </button>
        </div>
      </header>

      {isAdding && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Event Name</label>
                <input 
                  value={newHoliday.name}
                  onChange={e => setNewHoliday({...newHoliday, name: e.target.value})}
                  className="w-full border p-2 rounded text-sm"
                  placeholder="e.g. Midterm Exam"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input 
                  type="date"
                  value={newHoliday.date}
                  onChange={e => setNewHoliday({...newHoliday, date: e.target.value})}
                  className="border p-2 rounded text-sm"
                />
              </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Affected Classes (Optional - Leave empty for All Classes)</label>
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
            const isToday = isSameDay(date, new Date());
            const hasNationalHoliday = dateHolidays.some(h => h.type === 'national');
            const isSunday = date.getDay() === 0;
            const isRedDay = hasNationalHoliday || isSunday;
            
            return (
              <div key={date.toString()} className={cn("bg-white p-2 min-h-[100px] flex flex-col hover:bg-gray-50 transition-colors", isToday && "bg-indigo-50/30")}>
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
                        : "bg-indigo-50 text-indigo-900 border-indigo-100";
                    const subTextStyle = isNational
                        ? "text-red-600"
                        : classNames ? "text-indigo-600" : "text-gray-500";

                    return (
                      <div 
                        key={h.id} 
                        className={cn("group flex flex-col gap-0.5 px-2 py-1.5 rounded border text-xs mb-1", itemStyle)}
                      >
                        <div className="flex justify-between items-start">
                            <span className="font-semibold">{h.name}</span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); deleteHoliday(h.id); }}
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
  );
}
