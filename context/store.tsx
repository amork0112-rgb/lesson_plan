'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Book, Holiday, Class, BookAllocation, SpecialDate } from '@/types';
import { DEFAULT_HOLIDAYS, SAMPLE_CLASSES } from '@/lib/data';
import { getSupabase } from '@/lib/supabase';

interface DataContextType {
  books: Book[];
  holidays: Holiday[];
  classes: Class[];
  allocations: BookAllocation[];
  specialDates: Record<string, SpecialDate>;
  addBook: (book: Book) => void;
  updateBook: (id: string, updates: Partial<Book>) => void;
  deleteBook: (id: string) => void;
  addHoliday: (holiday: Holiday) => void;
  deleteHoliday: (id: string) => void;
  addClass: (cls: Class) => void;
  updateClass: (id: string, updates: Partial<Class>) => void;
  deleteClass: (id: string) => void;
  addAllocation: (allocation: BookAllocation) => void;
  updateAllocation: (id: string, updates: Partial<BookAllocation>) => void;
  deleteAllocation: (id: string) => void;
  setAllocations: (allocations: BookAllocation[]) => void;
  updateSpecialDate: (date: string, data: SpecialDate | null) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>(DEFAULT_HOLIDAYS);
  const [classes, setClasses] = useState<Class[]>(SAMPLE_CLASSES);
  const [allocations, setAllocations] = useState<BookAllocation[]>([]);
  const [specialDates, setSpecialDates] = useState<Record<string, SpecialDate>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const supabase = getSupabase();

  useEffect(() => {
    let cancelled = false;
    const loadCloud = async () => {
      if (!supabase) return false;
      const b = await supabase
        .from('books')
        .select('id,name,category,level,series,progression_type,volume_count,days_per_volume,series_level,total_units,unit_type,days_per_unit,review_units,total_sessions,units')
        .order('name', { ascending: true });
      const c = await supabase
        .from('classes')
        .select('id,name,year,level_group,weekly_sessions,sessions_per_month,start_time,end_time,dismissal_time,days,scp_type')
        .order('name', { ascending: true });
      const a = await supabase
        .from('allocations')
        .select('id,class_id,book_id,sessions_per_week,priority,total_sessions_override,manual_used,month,year');
      if (cancelled) return true;
      if (!b.error && Array.isArray(b.data)) setBooks(b.data as Book[]);
      if (!c.error && Array.isArray(c.data)) setClasses(c.data as Class[]);
      if (!a.error && Array.isArray(a.data)) setAllocations(a.data as BookAllocation[]);
      setHolidays([]);
      setSpecialDates({});
      setIsInitialized(true);
      return true;
    };
    const loadLocal = () => {
      const loadData = <T,>(key: string, setter: (data: T) => void) => {
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            setter(JSON.parse(saved) as T);
          } catch {}
        }
      };
      loadData<Book[]>('lesson_plan_books', setBooks);
      loadData<Holiday[]>('lesson_plan_holidays', setHolidays);
      loadData<Class[]>('lesson_plan_classes', setClasses);
      loadData<BookAllocation[]>('lesson_plan_allocations', setAllocations);
      loadData<Record<string, SpecialDate>>('lesson_plan_special_dates', setSpecialDates);
      setIsInitialized(true);
    };
    (async () => {
      const ok = await loadCloud();
      if (!ok) loadLocal();
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    const sync = async () => {
      if (!isInitialized) return;
      if (!supabase) {
        localStorage.setItem('lesson_plan_books', JSON.stringify(books));
      }
    };
    sync();
  }, [books, isInitialized, supabase]);

  useEffect(() => {
    const sync = async () => {
      if (!isInitialized) return;
      if (!supabase) {
        localStorage.setItem('lesson_plan_holidays', JSON.stringify(holidays));
      }
    };
    sync();
  }, [holidays, isInitialized, supabase]);

  useEffect(() => {
    const sync = async () => {
      if (!isInitialized) return;
      if (!supabase) {
        localStorage.setItem('lesson_plan_classes', JSON.stringify(classes));
      }
    };
    sync();
  }, [classes, isInitialized, supabase]);

  useEffect(() => {
    const sync = async () => {
      if (!isInitialized) return;
      if (!supabase) {
        localStorage.setItem('lesson_plan_allocations', JSON.stringify(allocations));
      }
    };
    sync();
  }, [allocations, isInitialized, supabase]);

  useEffect(() => {
    const sync = async () => {
      if (!isInitialized) return;
      if (!supabase) {
        localStorage.setItem('lesson_plan_special_dates', JSON.stringify(specialDates));
      }
    };
    sync();
  }, [specialDates, isInitialized, supabase]);

  const addBook = (book: Book) => setBooks([...books, book]);
  const updateBook = (id: string, updates: Partial<Book>) => {
    setBooks(books.map(b => b.id === id ? { ...b, ...updates } : b));
  };
  const deleteBook = (id: string) => setBooks(books.filter(b => b.id !== id));

  const addHoliday = (holiday: Holiday) => setHolidays([...holidays, holiday]);
  const deleteHoliday = (id: string) => setHolidays(holidays.filter(h => h.id !== id));

  const addClass = (cls: Class) => setClasses([...classes, cls]);
  const updateClass = (id: string, updates: Partial<Class>) => {
    setClasses(classes.map(c => c.id === id ? { ...c, ...updates } : c));
  };
  const deleteClass = (id: string) => setClasses(classes.filter(c => c.id !== id));

  const addAllocation = (allocation: BookAllocation) => setAllocations([...allocations, allocation]);
  const updateAllocation = (id: string, updates: Partial<BookAllocation>) => {
    setAllocations(allocations.map(a => a.id === id ? { ...a, ...updates } : a));
  };
  const deleteAllocation = (id: string) => setAllocations(allocations.filter(a => a.id !== id));

  const updateSpecialDate = (date: string, data: SpecialDate | null) => {
    setSpecialDates(prev => {
      const next = { ...prev };
      if (data) {
        next[date] = data;
      } else {
        delete next[date];
      }
      return next;
    });
  };

  return (
    <DataContext.Provider value={{
      books, holidays, classes, allocations, specialDates,
      addBook, updateBook, deleteBook,
      addHoliday, deleteHoliday,
      addClass, updateClass, deleteClass,
      addAllocation, updateAllocation, deleteAllocation, setAllocations,
      updateSpecialDate
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
