'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Book, Course, Holiday, Class, User, Role } from '@/types';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface DataContextType {
  books: Book[];
  courses: Course[];
  holidays: Holiday[];
  classes: Class[]; // Added classes
  user: User | null;
  loading: boolean;
  
  addBook: (book: Book) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  addCourse: (course: Course) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  addHoliday: (holiday: Holiday) => Promise<void>;
  deleteHoliday: (id: string) => Promise<void>;
  addClass: (cls: Class) => Promise<void>; // Added addClass
  
  signOut: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch initial data
  const fetchData = async () => {
    try {
      const { data: booksData } = await supabase.from('books').select('*');
      if (booksData) setBooks(booksData as any);

      const { data: coursesData } = await supabase.from('courses').select('*');
      if (coursesData) setCourses(coursesData as any);

      const { data: holidaysData } = await supabase.from('holidays').select('*');
      if (holidaysData) setHolidays(holidaysData as any);

      const { data: classesData } = await supabase.from('classes').select('*');
      if (classesData) setClasses(classesData as any);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
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
        fetchData();
      } else {
        setUser(null);
      }
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
        fetchData();
      } else {
        setUser(null);
        setBooks([]);
        setCourses([]);
        setHolidays([]);
        setClasses([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const addBook = async (book: Book) => {
    const { error } = await supabase.from('books').insert(book);
    if (!error) setBooks([...books, book]);
  };

  const deleteBook = async (id: string) => {
    const { error } = await supabase.from('books').delete().eq('id', id);
    if (!error) setBooks(books.filter(b => b.id !== id));
  };

  const addCourse = async (course: Course) => {
    const { error } = await supabase.from('courses').insert(course);
    if (!error) setCourses([...courses, course]);
  };

  const deleteCourse = async (id: string) => {
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (!error) setCourses(courses.filter(c => c.id !== id));
  };

  const addHoliday = async (holiday: Holiday) => {
    const { error } = await supabase.from('holidays').insert(holiday);
    if (!error) setHolidays([...holidays, holiday]);
  };

  const deleteHoliday = async (id: string) => {
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (!error) setHolidays(holidays.filter(h => h.id !== id));
  };
  
  const addClass = async (cls: Class) => {
    const { error } = await supabase.from('classes').insert(cls);
    if (!error) setClasses([...classes, cls]);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <DataContext.Provider value={{ 
      books, courses, holidays, classes, user, loading,
      addBook, deleteBook, 
      addCourse, deleteCourse,
      addHoliday, deleteHoliday,
      addClass,
      signOut
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
