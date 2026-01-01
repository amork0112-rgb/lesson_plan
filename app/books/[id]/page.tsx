'use client';

import { useState, useEffect, useRef } from 'react';
import { useData } from '@/context/store';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  GripVertical, 
  BookOpen, 
  GraduationCap,
  Clock,
  MoreVertical,
  LayoutList
} from 'lucide-react';
import { Book, LessonUnit, UnitType } from '@/types';
import { generateBookUnits } from '@/lib/logic';

export default function BookDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { books, updateBook, classes, allocations } = useData();
  
  const [book, setBook] = useState<Book | null>(null);
  const [units, setUnits] = useState<LessonUnit[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // Initialize book data
  useEffect(() => {
    if (id && books.length > 0) {
      const foundBook = books.find(b => b.id === id);
      if (foundBook) {
        setBook(foundBook);
        // Ensure units exist, otherwise generate them
        if (!foundBook.units || foundBook.units.length === 0) {
           const generated = generateBookUnits(foundBook);
           setUnits(generated);
        } else {
           setUnits(foundBook.units);
        }
      } else {
        // Handle not found
        router.push('/books');
      }
    }
  }, [id, books, router]);

  // Save changes
  const handleSave = () => {
    if (!book) return;
    
    // Recalculate sequences just in case
    const resequenced = units.map((u, i) => ({ ...u, sequence: i + 1 }));
    
    updateBook(book.id, {
      ...book,
      units: resequenced,
      total_sessions: resequenced.length // Update total sessions based on actual units
    });
    setUnits(resequenced);
    setIsDirty(false);
  };

  // Add Review
  const handleAddReview = () => {
    if (!book) return;
    const newReview: LessonUnit = {
      id: Math.random().toString(36).substr(2, 9),
      book_id: book.id,
      title: 'Review',
      type: 'review',
      sequence: units.length + 1
    };
    
    const newUnits = [...units, newReview];
    setUnits(newUnits);
    setIsDirty(true);
    
    // Scroll to bottom
    setTimeout(() => {
        const list = document.getElementById('unit-list');
        if (list) list.scrollTop = list.scrollHeight;
    }, 100);
  };

  // Remove Review
  const handleRemoveReview = (index: number) => {
    const unitToRemove = units[index];
    if (unitToRemove.type !== 'review') return; // Can only remove reviews
    
    // Check if used (This would require checking lesson plans, but for now we just warn if needed)
    // For MVP, we just remove it.
    
    const newUnits = units.filter((_, i) => i !== index)
                          .map((u, i) => ({ ...u, sequence: i + 1 }));
    setUnits(newUnits);
    setIsDirty(true);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent drag image or default
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    
    const newUnits = [...units];
    const draggedItem = newUnits[draggedItemIndex];
    
    // Remove dragged item
    newUnits.splice(draggedItemIndex, 1);
    // Insert at new position
    newUnits.splice(index, 0, draggedItem);
    
    setUnits(newUnits);
    setDraggedItemIndex(index);
    setIsDirty(true);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    // Auto save on drag end? Or wait for manual save?
    // User requirement: "Drag 후 자동 저장" (Auto save after drag)
    if (isDirty) {
        // We'll trigger a save logic here, but maybe debounce it or just set dirty
        // Actually user said "Drag 후 자동 저장", so let's save immediately after resequencing
        if (book) {
             const resequenced = units.map((u, i) => ({ ...u, sequence: i + 1 }));
             updateBook(book.id, { ...book, units: resequenced });
             setUnits(resequenced); // Update local state with clean sequences
             setIsDirty(false);
        }
    }
  };

  // Calculate stats
  const totalUnits = book?.total_units || 0;
  const daysPerUnit = book?.days_per_unit || 1;
  const calculatedSessions = units.filter(u => u.type === 'lesson').length;
  
  // Get Used By Classes
  const usedByAllocations = allocations.filter(a => a.book_id === book?.id);
  const usedByClasses = usedByAllocations.map(alloc => {
      const cls = classes.find(c => c.id === alloc.class_id);
      return {
          ...cls,
          allocation: alloc
      };
  }).filter(item => item.id); // Filter out undefined classes

  if (!book) return <div className="p-12 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
            <button 
                onClick={() => router.push('/books')}
                className="flex items-center text-slate-500 hover:text-slate-800 mb-4 transition-colors"
            >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Books
            </button>
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{book.name}</h1>
                    <div className="flex items-center gap-4 text-slate-500 text-sm">
                        <span className="flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-slate-200">
                            <LayoutList className="h-4 w-4" />
                            {book.category}
                        </span>
                        <span className="flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-slate-200">
                            <Clock className="h-4 w-4" />
                            Total Sessions: {units.length}
                        </span>
                    </div>
                </div>
                {/* 
                <button 
                    onClick={handleSave}
                    disabled={!isDirty}
                    className={`
                        flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all
                        ${isDirty 
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                    `}
                >
                    <Save className="h-4 w-4" />
                    Save Changes
                </button>
                */}
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content: Structure Editor */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Lesson Structure</h2>
                            <p className="text-xs text-slate-500 mt-1">Drag to reorder. Review units can be moved freely.</p>
                        </div>
                        <button 
                            onClick={handleAddReview}
                            className="text-sm flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all font-medium"
                        >
                            <Plus className="h-4 w-4" />
                            Add Review
                        </button>
                    </div>
                    
                    <div 
                        id="unit-list"
                        className="max-h-[600px] overflow-y-auto p-4 space-y-2 bg-slate-50/30"
                    >
                        {units.map((unit, index) => (
                            <div 
                                key={unit.id || index}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`
                                    flex items-center gap-3 p-3 rounded-xl border transition-all select-none
                                    ${draggedItemIndex === index ? 'opacity-50 bg-indigo-50 border-indigo-300 scale-[0.98]' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm'}
                                    ${unit.type === 'review' ? 'border-amber-100 bg-amber-50/30' : ''}
                                `}
                            >
                                <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1">
                                    <GripVertical className="h-5 w-5" />
                                </div>
                                
                                <div className={`
                                    h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0
                                    ${unit.type === 'lesson' 
                                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                                        : 'bg-amber-100 text-amber-600 border border-amber-200'}
                                `}>
                                    {unit.type === 'review' ? 'R' : unit.day_no || 'L'}
                                </div>
                                
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-slate-900">
                                        {unit.title}
                                    </div>
                                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                                        Sequence: #{index + 1}
                                    </div>
                                </div>
                                
                                {unit.type === 'review' && (
                                    <button 
                                        onClick={() => handleRemoveReview(index)}
                                        className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Remove Review"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                                {unit.type !== 'review' && (
                                    <div className="px-3 py-1 text-xs text-slate-400 bg-slate-100 rounded-md">
                                        Fixed
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar: Meta Info & Usage */}
            <div className="space-y-6">
                {/* Book Info Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Book Info
                    </h3>
                    
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-sm text-slate-500">Total Units</span>
                            <span className="text-sm font-medium text-slate-900">{totalUnits}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-sm text-slate-500">Days per Unit</span>
                            <span className="text-sm font-medium text-slate-900">{daysPerUnit}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-sm text-slate-500">Lesson Sessions</span>
                            <span className="text-sm font-medium text-slate-900">{calculatedSessions}</span>
                        </div>
                         <div className="flex justify-between items-center py-2">
                            <span className="text-sm text-slate-500">Total (with Reviews)</span>
                            <span className="text-sm font-bold text-indigo-600">{units.length}</span>
                        </div>
                    </div>
                </div>

                {/* Used By Classes Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Used by Classes
                    </h3>
                    
                    {usedByClasses.length > 0 ? (
                        <div className="space-y-3">
                            {usedByClasses.map((cls) => {
                                // Calculate usage (mock for now, or could calculate from lesson plans if available)
                                // Since we don't have easy access to lesson plans count here without heavy computation, 
                                // we'll show "Assigned" or total sessions needed.
                                
                                return (
                                    <div 
                                        key={cls.id}
                                        onClick={() => router.push('/classes')}
                                        className="group cursor-pointer p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-slate-700 group-hover:text-indigo-700">{cls.name}</span>
                                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                                {cls.year || new Date().getFullYear()}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                                            <div className="bg-indigo-500 h-full w-[0%]" style={{ width: '0%' }}></div> 
                                            {/* Progress bar could be real if we query lesson plans */}
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                                            <span>0 / {units.length} sessions used</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400 text-sm italic">
                            Not assigned to any class yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}