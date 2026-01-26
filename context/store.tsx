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
  const isCalendarPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/calendar');

  useEffect(() => {
    let cancelled = false;
    const loadCloud = async () => {
      // Use server APIs instead of direct Supabase calls
      const [bookRes, classRes] = await Promise.all([
        fetch('/api/books'),
        fetch('/api/classes'),
      ]);
      type ApiBook = {
        id: string;
        name: string;
        category?: string;
        level?: string;
        total_units?: number;
        days_per_unit?: number;
        total_sessions?: number;
        unit_type?: import('@/types').UnitType;
        review_units?: number;
        progression_type?: 'volume-day' | 'unit-day' | 'lesson';
        series?: string | null;
        volume_count?: number | null;
        days_per_volume?: number | null;
        series_level?: string | null;
        units?: unknown[];
      };
      type ApiClass = {
        class_id: string;
        class_name: string;
        campus?: string | null;
        weekdays?: number[] | null;
        class_start_time?: string | null;
        class_end_time?: string | null;
        dismissal_time?: string | null;
        level_group?: string | null;
        scp_type?: 'red' | 'orange' | 'yellow' | 'blue' | 'green' | null;
      };
      const bookJson: ApiBook[] = await bookRes.json();
      const classJson: ApiClass[] = await classRes.json();
      if (cancelled) return true;
      if (Array.isArray(bookJson)) {
        const mapped: Book[] = (bookJson as ApiBook[]).map((b) => ({
          id: b.id,
          name: b.name,
          category: b.category ?? 'others',
          level: b.level ?? '',
          series: b.series ?? undefined,
          progression_type: b.progression_type ?? 'unit-day',
          volume_count: b.volume_count ?? undefined,
          days_per_volume: b.days_per_volume ?? undefined,
          series_level: b.series_level ?? undefined,
          total_units: b.total_units ?? 0,
          unit_type: b.unit_type ?? 'unit',
          days_per_unit: b.days_per_unit ?? 1,
          review_units: b.review_units ?? 0,
          total_sessions: b.total_sessions ?? (b.total_units ?? 0) * (b.days_per_unit ?? 1),
          units: undefined,
        }));
        setBooks(mapped);
      }
      if (Array.isArray(classJson)) {
        const mapIdx: Record<number, import('@/types').Weekday> = {
          0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
        };
        const mapped: Class[] = (classJson as ApiClass[]).map((c) => {
          const daysNums: number[] | null = c.weekdays ?? null;
          const days = Array.isArray(daysNums) ? daysNums.map((n) => mapIdx[n]).filter(Boolean) : [];
          const weekly_sessions = days.length;
          const sessions_per_month = weekly_sessions === 3 ? 12 : weekly_sessions === 2 ? 8 : weekly_sessions * 4;
          return {
            id: c.class_id,
            name: c.class_name,
            year: new Date().getFullYear(),
            level_group: c.level_group ?? '',
            weekly_sessions,
            sessions_per_month,
            start_time: c.class_start_time ?? '14:00',
            end_time: c.class_end_time ?? '15:30',
            dismissal_time: c.dismissal_time ?? undefined,
            days,
            scp_type: c.scp_type ?? null,
          } as Class;
        });
        setClasses(mapped);
      }
      setAllocations([]);
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
      if (isCalendarPath) {
        loadLocal();
      } else {
        const ok = await loadCloud();
        if (!ok) loadLocal();
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, isCalendarPath]);

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
