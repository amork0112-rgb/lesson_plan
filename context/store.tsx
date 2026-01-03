'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Book, Holiday, Class, BookAllocation, SpecialDate } from '@/types';
import { SAMPLE_BOOKS, DEFAULT_HOLIDAYS, SAMPLE_CLASSES } from '@/lib/data';
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
  const [books, setBooks] = useState<Book[]>(SAMPLE_BOOKS);
  const [holidays, setHolidays] = useState<Holiday[]>(DEFAULT_HOLIDAYS);
  const [classes, setClasses] = useState<Class[]>(SAMPLE_CLASSES);
  const [allocations, setAllocations] = useState<BookAllocation[]>([]);
  const [specialDates, setSpecialDates] = useState<Record<string, SpecialDate>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const supabase = getSupabase();
  const orgKey = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_ORG_KEY || 'default') : 'default';

  useEffect(() => {
    let cancelled = false;
    const loadCloud = async () => {
      if (!supabase) return false;
      const b = await supabase.from('books').select('*').eq('org_key', orgKey);
      const c = await supabase.from('classes').select('*').eq('org_key', orgKey);
      const a = await supabase.from('allocations').select('*').eq('org_key', orgKey);
      const h = await supabase.from('holidays').select('*').eq('org_key', orgKey);
      const s = await supabase.from('special_dates').select('*').eq('org_key', orgKey);
      if (cancelled) return true;
      if (!b.error && b.data) setBooks(b.data.map((x: any) => {
        const { org_key, ...rest } = x;
        return rest;
      }));
      if (!c.error && c.data) setClasses(c.data.map((x: any) => {
        const { org_key, ...rest } = x;
        return rest;
      }));
      if (!a.error && a.data) setAllocations(a.data.map((x: any) => {
        const { org_key, ...rest } = x;
        return rest;
      }));
      if (!h.error && h.data) setHolidays(h.data.map((x: any) => {
        const { org_key, ...rest } = x;
        return rest;
      }));
      if (!s.error && s.data) {
        const obj: Record<string, SpecialDate> = {};
        (s.data as any[]).forEach((row: any) => {
          const { org_key, ...rest } = row;
          obj[rest.date] = { type: rest.type, name: rest.name };
        });
        setSpecialDates(obj);
      }
      setIsInitialized(true);
      return true;
    };
    const loadLocal = () => {
      const loadData = (key: string, setter: (data: any) => void) => {
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            setter(JSON.parse(saved));
          } catch {}
        }
      };
      loadData('lesson_plan_books', setBooks);
      loadData('lesson_plan_holidays', setHolidays);
      loadData('lesson_plan_classes', setClasses);
      loadData('lesson_plan_allocations', setAllocations);
      loadData('lesson_plan_special_dates', setSpecialDates);
      setIsInitialized(true);
    };
    (async () => {
      const ok = await loadCloud();
      if (!ok) loadLocal();
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const sync = async () => {
      if (!isInitialized) return;
      if (supabase) {
        await supabase.from('books').delete().eq('org_key', orgKey);
        if (books.length > 0) {
          await supabase.from('books').insert(books.map((x) => ({ ...x, org_key: orgKey })));
        }
      } else {
        localStorage.setItem('lesson_plan_books', JSON.stringify(books));
      }
    };
    sync();
  }, [books, isInitialized]);

  useEffect(() => {
    const sync = async () => {
      if (!isInitialized) return;
      if (supabase) {
        await supabase.from('holidays').delete().eq('org_key', orgKey);
        if (holidays.length > 0) {
          await supabase.from('holidays').insert(holidays.map((x) => ({ ...x, org_key: orgKey })));
        }
      } else {
        localStorage.setItem('lesson_plan_holidays', JSON.stringify(holidays));
      }
    };
    sync();
  }, [holidays, isInitialized]);

  useEffect(() => {
    const sync = async () => {
      if (!isInitialized) return;
      if (supabase) {
        await supabase.from('classes').delete().eq('org_key', orgKey);
        if (classes.length > 0) {
          await supabase.from('classes').insert(classes.map((x) => ({ ...x, org_key: orgKey })));
        }
      } else {
        localStorage.setItem('lesson_plan_classes', JSON.stringify(classes));
      }
    };
    sync();
  }, [classes, isInitialized]);

  useEffect(() => {
    const sync = async () => {
      if (!isInitialized) return;
      if (supabase) {
        await supabase.from('allocations').delete().eq('org_key', orgKey);
        if (allocations.length > 0) {
          await supabase.from('allocations').insert(allocations.map((x) => ({ ...x, org_key: orgKey })));
        }
      } else {
        localStorage.setItem('lesson_plan_allocations', JSON.stringify(allocations));
      }
    };
    sync();
  }, [allocations, isInitialized]);

  useEffect(() => {
    const sync = async () => {
      if (!isInitialized) return;
      if (supabase) {
        await supabase.from('special_dates').delete().eq('org_key', orgKey);
        const arr = Object.entries(specialDates).map(([date, val]) => ({ date, ...val, org_key: orgKey }));
        if (arr.length > 0) {
          await supabase.from('special_dates').insert(arr as any);
        }
      } else {
        localStorage.setItem('lesson_plan_special_dates', JSON.stringify(specialDates));
      }
    };
    sync();
  }, [specialDates, isInitialized]);

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
