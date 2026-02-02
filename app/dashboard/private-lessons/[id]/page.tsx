'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Calendar, 
  BookOpen, 
  Clock, 
  MoreVertical, 
  Plus, 
  Trash2,
  RefreshCw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PrivateLesson, LessonPlan, Book } from '@/types';

export default function PrivateLessonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [lesson, setLesson] = useState<PrivateLesson | null>(null);
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'plan'>('plan');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Private Lesson Info
      const resLesson = await fetch(`/api/private-lessons/${id}`); 
      
      if (!resLesson.ok) {
        if (resLesson.status === 404) {
          alert('Lesson not found');
          router.push('/dashboard/private-lessons');
          return;
        }
        throw new Error('Failed to fetch lesson');
      }

      const found = await resLesson.json();
      setLesson(found);

      // 2. Fetch Book
      if (found.book_id) {
        const resBook = await fetch(`/api/books/${found.book_id}`);
        if (resBook.ok) {
          setBook(await resBook.json());
        }
      }

      // 3. Fetch Plans
      const resPlans = await fetch(`/api/lesson-plans?owner_id=${id}&owner_type=private`);
      if (resPlans.ok) {
        const data = await resPlans.json();
        setPlans(data.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this private lesson? This action cannot be undone.')) return;
    
    try {
      const res = await fetch(`/api/private-lessons/${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        router.push('/dashboard/private-lessons');
      } else {
        alert('Failed to delete');
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting lesson');
    }
  };


  const handleGenerate = async (limit: number) => {
    if (!lesson?.book_id) {
      alert('No book assigned to this student');
      return;
    }

    try {
      setGenerating(true);
      const res = await fetch(`/api/private-lessons/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: lesson.book_id,
          limit
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const data = await res.json();
      alert(`Successfully generated ${data.count} sessions!`);
      fetchData(); // Refresh

    } catch (e: any) {
      alert('Generation Failed: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading details...</div>;
  if (!lesson) return <div className="p-8 text-center">Lesson not found</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => router.back()}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{lesson.student_name}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">Private Lesson</span>
            <span className="flex items-center gap-1">
              <BookOpen size={14} />
              {book?.name || 'No Book'}
            </span>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
            <button
              onClick={handleDelete}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2"
              title="Delete Private Lesson"
            >
              <Trash2 size={20} />
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'plan' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Lesson Plan
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl">
          <h3 className="font-semibold text-lg mb-4">Student Details</h3>
          <div className="space-y-4">
            <div>
                <label className="text-xs text-slate-400 uppercase font-bold">Status</label>
                <div className="mt-1">{lesson.status}</div>
            </div>
            <div>
                <label className="text-xs text-slate-400 uppercase font-bold">Schedule</label>
                <div className="mt-1 font-mono text-sm bg-slate-50 p-2 rounded inline-block">
                    {JSON.stringify(lesson.schedule, null, 2)}
                </div>
            </div>
            <div>
                <label className="text-xs text-slate-400 uppercase font-bold">Start Date</label>
                <div className="mt-1">{lesson.start_date}</div>
            </div>
            <div>
                <label className="text-xs text-slate-400 uppercase font-bold">Memo</label>
                <div className="mt-1 text-slate-600">{lesson.memo || '-'}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'plan' && (
        <div className="space-y-6">
            {/* Generator Controls */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <h3 className="text-blue-900 font-semibold text-sm">Plan Generator</h3>
                    <p className="text-blue-500 text-xs mt-1">Generate next sessions based on current progress</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleGenerate(5)}
                        disabled={generating}
                        className="px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50 shadow-sm flex items-center gap-2"
                    >
                        {generating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                        Next 5 Sessions
                    </button>
                    <button
                        onClick={() => handleGenerate(10)}
                        disabled={generating}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shadow-sm flex items-center gap-2"
                    >
                        {generating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                        Next 10 Sessions
                    </button>
                </div>
            </div>

            {/* Plan List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                            <th className="px-6 py-3 font-medium">Date</th>
                            <th className="px-6 py-3 font-medium">Book</th>
                            <th className="px-6 py-3 font-medium">Unit / Day</th>
                            <th className="px-6 py-3 font-medium">Content</th>
                            <th className="px-6 py-3 font-medium text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {plans.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                    No plans generated yet. Click "Next 5 Sessions" to start.
                                </td>
                            </tr>
                        ) : (
                            plans.map((plan) => {
                                const isPast = new Date(plan.date) < new Date();
                                return (
                                    <tr key={plan.id} className="hover:bg-slate-50 group">
                                        <td className="px-6 py-3 font-mono text-slate-600">
                                            {plan.date} <span className="text-xs text-slate-400 ml-1">({format(parseISO(plan.date), 'EEE')})</span>
                                        </td>
                                        <td className="px-6 py-3 text-slate-900 font-medium">
                                            {plan.books?.name || book?.name || '-'}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                                U{plan.unit_no} D{plan.day_no}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600">
                                            {plan.content}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            {isPast ? (
                                                <span className="text-xs text-green-600 font-medium">Completed</span>
                                            ) : (
                                                <span className="text-xs text-slate-400">Upcoming</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
}
