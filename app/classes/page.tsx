'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Plus, Save, Trash2 } from 'lucide-react';
import { Weekday } from '@/types';

// Types
type ClassView = {
  class_id: string;
  class_name: string;
  campus?: string | null;
  weekdays?: number[] | null;
  class_start_time?: string | null;
  class_end_time?: string | null;
};

type BookLite = {
  id: string;
  name: string;
  category?: string;
  level?: string;
  total_units?: number;
  days_per_unit?: number;
  total_sessions?: number;
};

type CourseView = {
  id: string; // allocation_id
  section: string;
  book: { id: string; name: string };
  total_sessions: number;
  remaining_sessions: number;
  sessions_by_month: Record<number, number>;
};

const DAY_MAP: Record<Weekday, string> = { Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토', Sun: '일' };

function to12h(time?: string | null) {
  if (!time) return '';
  const [hh, mm] = time.split(':');
  const h = parseInt(hh, 10);
  const twelve = ((h % 12) || 12).toString();
  return `${twelve}:${mm}`;
}

function formatWeekdays(nums?: number[] | null) {
  if (!nums || nums.length === 0) return '';
  const mapIdx: Record<number, Weekday> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
  return nums.map(n => DAY_MAP[mapIdx[n] || 'Mon']).join('');
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassView[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  
  // State for the expanded class
  const [courses, setCourses] = useState<CourseView[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [allBooks, setAllBooks] = useState<BookLite[]>([]);
  const [bookSearchTerm, setBookSearchTerm] = useState('');
  const [addingBook, setAddingBook] = useState<{ book_id: string | null; total_sessions: number }>({
    book_id: null,
    total_sessions: 0,
  });
  


  // Fetch classes on mount
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res = await fetch('/api/classes');
        const json: unknown = await res.json();
        if (Array.isArray(json)) {
          setClasses(json as unknown as ClassView[]);
        }
      } catch (e) {
        console.error('Failed to fetch classes', e);
      }
    };
    fetchAll();
    
    // Also fetch books for the quick add feature
    const fetchBooks = async () => {
      try {
        const res = await fetch('/api/books');
        const json: unknown = await res.json();
        if (Array.isArray(json)) {
          setAllBooks(json as BookLite[]);
        }
      } catch (e) {
        console.error('Failed to fetch books', e);
      }
    };
    fetchBooks();
  }, []);

  // Fetch courses when a class is expanded
  useEffect(() => {
    if (!expandedClassId) {
      setCourses([]);
      return;
    }
    
    const fetchCourses = async () => {
      setLoadingCourses(true);
      try {
        const res = await fetch(`/api/classes/${expandedClassId}/assigned-courses`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json)) {
            setCourses(json as CourseView[]);
          }
        }
      } catch (e) {
        console.error('Failed to fetch courses', e);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchCourses();
  }, [expandedClassId]);

  const filteredClasses = classes.filter(c =>
    c.class_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBooks = useMemo(() => {
    const term = bookSearchTerm.trim().toLowerCase();
    return term ? allBooks.filter(b => b.name.toLowerCase().includes(term)) : allBooks;
  }, [allBooks, bookSearchTerm]);

  const handleAddCourse = async (book: BookLite) => {
    if (!expandedClassId) return;
    
    try {
      // Use the 'books' endpoint which creates allocations
      const res = await fetch(`/api/classes/${expandedClassId}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: book.id,
          priority: courses.length + 1, // Simple priority
          sessions_per_week: 1, // Default
        }),
      });

      if (!res.ok) throw new Error('Failed to add course');
      
      // Refresh courses
      const refresh = await fetch(`/api/classes/${expandedClassId}/assigned-courses`);
      const json = await refresh.json();
      setCourses(json as CourseView[]);
      setBookSearchTerm(''); // Reset search
    } catch (e) {
      alert('Failed to add course');
      console.error(e);
    }
  };

  const handleUpdateSession = async (courseIdx: number, month: number, value: number) => {
    const updatedCourses = [...courses];
    const course = updatedCourses[courseIdx];
    
    // Optimistic update
    updatedCourses[courseIdx] = {
      ...course,
      sessions_by_month: { ...course.sessions_by_month, [month]: value }
    };
    setCourses(updatedCourses);
  };

  const handleSaveCourse = async (course: CourseView) => {
    try {
      const res = await fetch(`/api/courses/${course.id}/sessions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions_by_month: course.sessions_by_month }),
      });
      
      if (!res.ok) throw new Error('Failed to save sessions');
      
      // Refresh to get calculated remaining sessions correctly from server if needed,
      // but optimistic update might be enough. Let's refresh to be safe.
      const refresh = await fetch(`/api/classes/${expandedClassId}/assigned-courses`);
      const json = await refresh.json();
      setCourses(json as CourseView[]);
    } catch (e) {
      alert('Failed to save sessions');
      console.error(e);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to remove this course?')) return;
    
    try {
      const res = await fetch(`/api/courses/${courseId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete course');
      
      const refresh = await fetch(`/api/classes/${expandedClassId}/assigned-courses`);
      const json = await refresh.json();
      setCourses(json as CourseView[]);
    } catch (e) {
      alert('Failed to delete course');
      console.error(e);
    }
  };




  return (
    <div className="min-h-screen bg-slate-50 p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-light text-slate-900 tracking-tight mb-2">Class Management</h1>
            <p className="text-slate-500 font-light">View classes and manage assigned courses.</p>
          </div>
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

        <div className="space-y-4">
          {filteredClasses.map((cls) => {
            const isExpanded = expandedClassId === cls.class_id;
            
            return (
              <div key={cls.class_id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200">
                {/* Header Row */}
                <div 
                  onClick={() => setExpandedClassId(isExpanded ? null : cls.class_id)}
                  className={`flex items-center justify-between px-6 py-5 cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50 border-b border-slate-100' : ''}`}
                >
                  <div className="flex items-center gap-8 flex-1">
                    <div className="w-64 font-medium text-slate-900 text-lg">{cls.class_name}</div>
                    <div className="w-40 text-sm text-slate-600">{cls.campus || '-'}</div>
                    <div className="w-40 text-sm text-slate-600">{formatWeekdays(cls.weekdays)}</div>
                    <div className="text-sm font-medium text-slate-600">
                      {to12h(cls.class_start_time)} ~ {to12h(cls.class_end_time)}
                    </div>
                  </div>
                  <div>
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-6 bg-slate-50/50">
                    <div className="flex flex-col gap-6">
                      {/* Top: Quick Add */}
                      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                        <div className="flex items-center gap-6 mb-3">
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Quick Add Book</h3>
                          <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search books..."
                              value={bookSearchTerm}
                              onChange={(e) => setBookSearchTerm(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                        
                        {/* List - Limit height to approx 2 items (~80-90px) */}
                        <div className="space-y-1 max-h-[90px] overflow-y-auto pr-1">
                          {filteredBooks.length === 0 ? (
                            <div className="text-sm text-slate-400 text-center py-2">No books found</div>
                          ) : (
                            filteredBooks.map(b => (
                              <div key={b.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group border border-transparent hover:border-slate-100">
                                <div className="text-sm text-slate-700 truncate mr-2">{b.name}</div>
                                <button
                                  onClick={() => handleAddCourse(b)}
                                  className="text-xs bg-indigo-600 text-white px-3 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-700"
                                >
                                  Add
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Bottom: Assigned Courses Table */}
                      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Courses</h3>
                        </div>
                        
                        {loadingCourses ? (
                          <div className="p-8 text-center text-slate-500">Loading courses...</div>
                        ) : courses.length === 0 ? (
                          <div className="p-8 text-center text-slate-500">No courses assigned yet. Use Quick Add to assign books.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                  <th className="px-4 py-3 w-48">Book</th>
                                  <th className="px-2 py-3 text-center w-16">Total</th>
                                  <th className="px-2 py-3 text-center w-16">Left</th>
                                  {[1, 2, 3, 4, 5, 6].map(m => (
                                    <th key={m} className="px-2 py-3 text-center w-14">Month {m}</th>
                                  ))}
                                  <th className="px-4 py-3 text-right w-24">Action</th>
                                </tr>

                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {courses.map((course, idx) => {
                                  const used = Object.values(course.sessions_by_month).reduce((sum, v) => sum + (v || 0), 0);
                                  const remaining = (course.total_sessions || 0) - used;
                                  
                                  return (
                                    <tr key={course.id} className="hover:bg-indigo-50/10">
                                      <td className="px-4 py-3">
                                        <div className="text-sm font-medium text-slate-900">{course.book.name}</div>
                                        <div className="text-xs text-slate-400">{course.section}</div>
                                      </td>
                                      <td className="px-2 py-3 text-center text-sm text-slate-600">{course.total_sessions}</td>
                                      <td className={`px-2 py-3 text-center text-sm font-medium ${remaining < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                        {remaining}
                                      </td>
                                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <td key={m} className="px-2 py-3 text-center">
                                          <input
                                            type="number"
                                            min="0"
                                            className="w-12 text-center text-sm border-gray-200 rounded focus:ring-indigo-500 focus:border-indigo-500 py-1"
                                            value={course.sessions_by_month[m] || ''}
                                            onChange={(e) => handleUpdateSession(idx, m, parseInt(e.target.value) || 0)}
                                          />
                                        </td>
                                      ))}
                                      <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <button 
                                            onClick={() => handleSaveCourse(course)}
                                            className="text-indigo-600 hover:text-indigo-800 p-1"
                                            title="Save"
                                          >
                                            <Save className="h-4 w-4" />
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteCourse(course.id)}
                                            className="text-slate-400 hover:text-red-600 p-1"
                                            title="Delete"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
