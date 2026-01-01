'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Book, Holiday, Class, BookAllocation, SpecialDate } from '@/types';
import { SAMPLE_BOOKS, DEFAULT_HOLIDAYS, SAMPLE_CLASSES } from '@/lib/data';

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

  // Load from localStorage on mount
  useEffect(() => {
    const loadData = (key: string, setter: (data: any) => void) => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setter(JSON.parse(saved));
        } catch (e) {
          console.error(`Failed to parse ${key}`, e);
        }
      }
    };

    loadData('lesson_plan_books', setBooks);
    loadData('lesson_plan_holidays', setHolidays);
    loadData('lesson_plan_classes', setClasses);
    loadData('lesson_plan_allocations', setAllocations);
    loadData('lesson_plan_special_dates', setSpecialDates);
    setIsInitialized(true);
  }, []);

  // Save to localStorage on change (only after initialization)
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('lesson_plan_books', JSON.stringify(books));
    }
  }, [books, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('lesson_plan_holidays', JSON.stringify(holidays));
    }
  }, [holidays, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('lesson_plan_classes', JSON.stringify(classes));
    }
  }, [classes, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('lesson_plan_allocations', JSON.stringify(allocations));
    }
  }, [allocations, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('lesson_plan_special_dates', JSON.stringify(specialDates));
    }
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
