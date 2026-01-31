'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Book, Course, Holiday, Class, User, Role, BookAllocation, SpecialDate, SpecialDateType } from '@/types';
import { getSupabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const supabase = getSupabase();

interface DataContextType {
  books: Book[];
  courses: Course[];
  holidays: Holiday[];
  classes: Class[];
  allocations: BookAllocation[];
  setAllocations: (allocations: BookAllocation[]) => void;
  specialDates: Record<string, SpecialDate>;
  user: User | null;
  loading: boolean;
  
  addBook: (book: Book) => Promise<void>;
  updateBook: (id: string, updates: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  addCourse: (course: Course) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  addHoliday: (holiday: Holiday) => Promise<void>;
  deleteHoliday: (id: string) => Promise<void>;
  addClass: (cls: Class) => Promise<void>;
  updateSpecialDate: (date: string, data: SpecialDate | null) => Promise<void>;
  
  signOut: () => Promise<void>;
  refreshBooks: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [allocations, setAllocations] = useState<BookAllocation[]>([]);
  const [specialDates, setSpecialDates] = useState<Record<string, SpecialDate>>({});
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch initial data
  const fetchData = async () => {
    if (!supabase) return;
    try {
      const { data: booksData } = await supabase.from('books').select('*');
      if (booksData) setBooks(booksData as any);

      const { data: coursesData } = await supabase.from('courses').select('*');
      if (coursesData) setCourses(coursesData as any);

      try {
        const calRes = await fetch('/api/calendar');
        if (calRes.ok) {
           const { holidays: hData, special_dates: sData } = await calRes.json();
           setHolidays(hData || []);
           
           const map: Record<string, SpecialDate> = {};
           (sData || []).forEach((d: any) => {
                map[d.date] = { 
                    type: d.type as SpecialDateType, 
                    name: d.name 
                };
           });
           setSpecialDates(map);
        }
      } catch (e) {
         console.error('Failed to fetch calendar data', e);
      }

      try {
        const classesRes = await fetch('/api/raw-classes');
        if (classesRes.ok) {
          const classesData = await classesRes.json();
          if (Array.isArray(classesData)) {
            console.log('[Store] Loaded classes:', classesData.length);
            
            // Map raw 'weekdays' (integers) to 'days' (Weekday strings)
            // 0=Sun, 1=Mon, ..., 6=Sat
            const DAY_MAP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            
            const mappedClasses = classesData.map((c: any) => {
                let days: string[] = [];
                // Handle both integer and string weekdays
                if (Array.isArray(c.weekdays) && c.weekdays.length > 0) {
                    if (typeof c.weekdays[0] === 'number') {
                        days = c.weekdays.map((w: number) => DAY_MAP[w]).filter(Boolean);
                    } else {
                        days = c.weekdays;
                    }
                } else {
                    days = c.days || [];
                }
                
                return {
                    ...c,
                    days
                };
            });
            
            setClasses(mappedClasses as Class[]);
          } else {
            console.error('[Store] Classes data is not an array:', classesData);
          }
        } else {
          const text = await classesRes.text();
          console.error('[Store] Failed to fetch classes:', classesRes.status, classesRes.statusText, text);
        }
      } catch (e) {
        console.error('Failed to fetch classes via API', e);
      }

      const { data: allocationsData } = await supabase.from('class_book_allocations').select('*');
      if (allocationsData) setAllocations(allocationsData as any);

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const role = session.user.app_metadata.role as Role || 'teacher';
        setUser({
          id: session.user.id,
          email: session.user.email!,
          role: role,
          name: session.user.user_metadata.full_name || session.user.email,
        });
      } else {
        setUser(null);
      }
      // Always try to fetch data. 
      // API-based data (classes) should work regardless of RLS if the API is public/service-role.
      // Supabase-based data (books) will obey RLS (empty if not logged in).
      fetchData(); 
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const role = session.user.app_metadata.role as Role || 'teacher';
        setUser({
          id: session.user.id,
          email: session.user.email!,
          role: role,
          name: session.user.user_metadata.full_name || session.user.email,
        });
      } else {
        setUser(null);
        setBooks([]);
        setCourses([]);
        setHolidays([]);
        // Do not clear classes here, let fetchData refresh them. 
        // Or clear them if you want to ensure no stale data.
        // Since classes are public-ish, we can leave them or clear them.
        // Let's clear allocations and user-specific data.
        setAllocations([]);
        setSpecialDates({});
      }
      fetchData();
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const addBook = async (book: Book) => {
    if (!supabase) return;
    const { error } = await supabase.from('books').insert(book);
    if (!error) setBooks([...books, book]);
  };

  const updateBook = async (id: string, updates: Partial<Book>) => {
    if (!supabase) return;
    const { error } = await supabase.from('books').update(updates).eq('id', id);
    if (!error) {
      setBooks(books.map(b => b.id === id ? { ...b, ...updates } : b));
    }
  };

  const deleteBook = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('books').delete().eq('id', id);
    if (!error) setBooks(books.filter(b => b.id !== id));
  };

  const addCourse = async (course: Course) => {
    if (!supabase) return;
    const { error } = await supabase.from('courses').insert(course);
    if (!error) setCourses([...courses, course]);
  };

  const deleteCourse = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (!error) setCourses(courses.filter(c => c.id !== id));
  };

  const addHoliday = async (holiday: Holiday) => {
    try {
      const res = await fetch('/api/calendar/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(holiday)
      });
      if (!res.ok) throw new Error('Failed to add holiday');
      setHolidays([...holidays, holiday]);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteHoliday = async (id: string) => {
    try {
      const res = await fetch(`/api/calendar/holidays/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete holiday');
      setHolidays(holidays.filter(h => h.id !== id));
    } catch (e) {
      console.error(e);
    }
  };
  
  const addClass = async (cls: Class) => {
    if (!supabase) return;
    const { error } = await supabase.from('classes').insert(cls);
    if (!error) setClasses([...classes, cls]);
  };

  const updateSpecialDate = async (date: string, data: SpecialDate | null) => {
    try {
        if (data) {
            const res = await fetch('/api/calendar/special-dates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, ...data })
            });
            if (!res.ok) throw new Error('Failed to update special date');
            setSpecialDates(prev => ({ ...prev, [date]: data }));
        } else {
            const res = await fetch(`/api/calendar/special-dates/${date}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete special date');
            setSpecialDates(prev => {
                const next = { ...prev };
                delete next[date];
                return next;
            });
        }
    } catch (e) {
        console.error(e);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

  const refreshBooks = async () => {
    if (!supabase) return;
    const { data: booksData } = await supabase.from('books').select('*');
    if (booksData) setBooks(booksData as any);
  };

  return (
    <DataContext.Provider value={{ 
      books, courses, holidays, classes, allocations, setAllocations, specialDates, user, loading,
      addBook, updateBook, deleteBook, 
      addCourse, deleteCourse,
      addHoliday, deleteHoliday,
      addClass,
      updateSpecialDate,
      signOut,
      refreshBooks
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
