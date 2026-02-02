//app/dashboard/private-lessons/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, User, Calendar, BookOpen, Clock, Check } from 'lucide-react';
import { format } from 'date-fns';
import { PrivateLesson, Book, Class } from '@/types';

interface Student {
  id: string;
  korean_name: string;
  english_name: string;
  campus: string;
  class_id: string;
}

export default function PrivateLessonsPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<PrivateLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);

  // New Student Flow State
  const [campuses, setCampuses] = useState<string[]>(['International', 'Domestic']);
  const [selectedCampus, setSelectedCampus] = useState<string>('International');
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const [studentSearch, setStudentSearch] = useState('');
  const [foundStudents, setFoundStudents] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    student_name: '',
    student_id: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    book_id: '',
    schedule: {} as Record<string, string>, // { "Mon": "14:00" }
    memo: ''
  });

  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [commonTime, setCommonTime] = useState('14:00');

  useEffect(() => {
    fetchLessons();
    fetchBooks();
    fetchCampuses();
  }, []);

  useEffect(() => {
    if (selectedCampus) {
        fetchClasses(selectedCampus);
        setSelectedClassId('');
        setStudentSearch('');
        setSelectedStudent(null);
    }
  }, [selectedCampus]);

  const fetchClasses = async (campus: string) => {
    try {
        const res = await fetch(`/api/classes?campus=${campus}`);
        if (res.ok) {
            const data = await res.json();
            setClasses(data);
        }
    } catch(e) {
        console.error(e);
    }
  };

  // Search Effect
  useEffect(() => {
    if (!studentSearch || studentSearch.length < 1) {
        setFoundStudents([]);
        return;
    }
    
    // Don't search if we just selected a student and the name matches
    if (selectedStudent && (
        studentSearch === selectedStudent.korean_name || 
        studentSearch === selectedStudent.english_name ||
        studentSearch === `${selectedStudent.korean_name} (${selectedStudent.english_name})`
    )) {
        return;
    }

    const timer = setTimeout(async () => {
        setIsSearching(true);
        try {
            // Include class_id in search
            const query = new URLSearchParams({
                campus: selectedCampus,
                search: studentSearch
            });
            if (selectedClassId) {
                query.append('class_id', selectedClassId);
            }

            const res = await fetch(`/api/students?${query.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setFoundStudents(data);
            }
        } catch(e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch, selectedCampus, selectedClassId]);

  const fetchCampuses = async () => {
      try {
          const res = await fetch('/api/classes');
          if (res.ok) {
              const data = await res.json();
              const unique = Array.from(new Set(data.map((c: any) => c.campus).filter(Boolean))) as string[];
              if (unique.length > 0) setCampuses(unique.sort());
          }
      } catch (e) {
          console.error(e);
      }
  };

  const fetchLessons = async () => {
    try {
      const res = await fetch('/api/private-lessons');
      if (res.ok) {
        const data = await res.json();
        setLessons(data);
      }
    } catch (e) {
      console.error('Failed to fetch lessons', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBooks = async () => {
    try {
      const res = await fetch('/api/books');
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
      }
    } catch (e) {
      console.error('Failed to fetch books', e);
    }
  };

  const handleCreate = async () => {
    if (!formData.student_name || !formData.book_id) {
      alert('Student Name and Book are required');
      return;
    }

    // Construct schedule from selectedDays
    const schedule: Record<string, string> = {};
    selectedDays.forEach(day => {
      schedule[day] = commonTime;
    });

    try {
      const payload = {
        ...formData,
        schedule,
        campus_id: selectedCampus,
        class_id: selectedClassId
      };

      const res = await fetch('/api/private-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchLessons();
        // Reset form
        setFormData({
            student_name: '',
            student_id: '',
            start_date: format(new Date(), 'yyyy-MM-dd'),
            book_id: '',
            schedule: {},
            memo: ''
        });
        setSelectedDays([]);
        setStudentSearch('');
        setSelectedStudent(null);
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (e) {
      alert('Failed to create');
    }
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(prev => prev.filter(d => d !== day));
    } else {
      setSelectedDays(prev => [...prev, day]);
    }
  };

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Private Lessons</h1>
          <p className="text-slate-500 mt-1">Manage individual student schedules and plans</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          <span>New Student</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : lessons.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <User className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No private lessons yet</h3>
          <p className="text-slate-500 mb-6">Add your first private student to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-blue-600 font-medium hover:text-blue-700"
          >
            Create Private Lesson
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessons.map(lesson => {
            // Find book name
            const book = books.find(b => b.id === (lesson as any).book_id); // Type casting if needed
            const scheduleStr = lesson.schedule 
                ? Object.keys(lesson.schedule).join(', ') + ' @ ' + Object.values(lesson.schedule)[0]
                : 'No Schedule';

            return (
              <div 
                key={lesson.id}
                onClick={() => router.push(`/dashboard/private-lessons/${lesson.id}`)}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                      {lesson.student_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {lesson.student_name}
                      </h3>
                      <p className="text-xs text-slate-500">Private Lesson</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    lesson.status === 'active' ? 'bg-green-100 text-green-700' : 
                    lesson.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {lesson.status}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <BookOpen size={16} className="text-slate-400" />
                    <span className="truncate">{book?.name || 'No Book Assigned'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock size={16} className="text-slate-400" />
                    <span>{scheduleStr}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar size={16} className="text-slate-400" />
                    <span>Started {lesson.start_date}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-semibold text-lg">New Private Lesson</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Student Name</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.student_name}
                  onChange={e => setFormData({...formData, student_name: e.target.value})}
                  placeholder="e.g. Minjun Kim"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Book</label>
                <select 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.book_id}
                  onChange={e => setFormData({...formData, book_id: e.target.value})}
                >
                  <option value="">Select a book...</option>
                  {books.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Schedule</label>
                <div className="flex gap-2 mb-2">
                    {WEEKDAYS.map(day => (
                        <button
                            key={day}
                            onClick={() => toggleDay(day)}
                            className={`px-2 py-1 text-xs rounded border ${
                                selectedDays.includes(day) 
                                ? 'bg-blue-600 text-white border-blue-600' 
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {day}
                        </button>
                    ))}
                </div>
                <input 
                  type="time" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={commonTime}
                  onChange={e => setCommonTime(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">Time applies to all selected days</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.start_date}
                  onChange={e => setFormData({...formData, start_date: e.target.value})}
                />
              </div>

            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
              >
                Create Student
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
