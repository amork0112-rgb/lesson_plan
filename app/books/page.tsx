'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useData } from '@/context/store';
import { Plus, Search, Book as BookIcon, X, ChevronRight, GraduationCap, ArrowRight, Trash2 } from 'lucide-react';
import { Book, UnitType } from '@/types';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';

const CATEGORIES = [
  { id: 'c_reading', label: 'Reading' },
  { id: 'c_listening', label: 'Listening' },
  { id: 'c_speaking', label: 'Speaking' },
  { id: 'c_writing', label: 'Writing' },
  { id: 'c_grammar', label: 'Grammar' },
  { id: 'c_voca', label: 'Voca' },
  { id: 'others', label: 'Others' }
];

export default function BooksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { books, addBook, allocations, classes, addAllocation, deleteAllocation } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  const tabs = [
    { id: 'all', label: 'All Books' },
    ...classes.map(c => ({ id: c.id, label: c.name }))
  ];
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Book>>({
    name: '',
    category: 'c_reading',
    level: '',
    total_units: 10,
    unit_type: 'unit',
    review_units: 0,
    total_sessions: 10
  });

  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [autoInit, setAutoInit] = useState<Set<string>>(new Set());

  const filteredBooks = books.filter(b => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = b.name.toLowerCase().includes(q) || (b.level || '').toLowerCase().includes(q);
    return matchesSearch;
  });
  const limitedSearch = filteredBooks;

  useEffect(() => {
    const cid = searchParams.get('classId');
    if (cid) setActiveTab(cid);
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'all') return;
    const hasAllocations = allocations.some(a => a.class_id === activeTab);
    if (hasAllocations) return;
    if (autoInit.has(activeTab)) return;
    const cls = classes.find(c => c.id === activeTab);
    if (!cls) return;
    const lvl = cls.name.trim().toLowerCase();
    const matches = books.filter(b => (b.level || '').trim().toLowerCase() === lvl);
    let basePriority = Math.max(0, ...allocations.filter(a => a.class_id === activeTab).map(a => a.priority || 0));
    matches.forEach((book) => {
      if (!isAssignedToClass(book.id, activeTab)) {
        addAllocation({
          id: Math.random().toString(36).substr(2, 9),
          book_id: book.id,
          class_id: activeTab,
          sessions_per_week: 1,
          priority: ++basePriority
        });
      }
    });
    setAutoInit(new Set([...autoInit, activeTab]));
  }, [activeTab, allocations, classes, books]);

  const getAssignedBooks = (classId: string) => {
    return allocations
      .filter(a => a.class_id === classId)
      .map(a => {
        const book = books.find(b => b.id === a.book_id);
        return { ...a, book };
      })
      .filter(item => item.book !== undefined);
  };

  const isAssignedToClass = (bookId: string, classId: string) => {
    return allocations.some(a => a.book_id === bookId && a.class_id === classId);
  };

  const handleAddToClass = (bookId: string) => {
    if (activeTab === 'all') return;
    if (isAssignedToClass(bookId, activeTab)) return;
    const nextPriority = Math.max(0, ...allocations.filter(a => a.class_id === activeTab).map(a => a.priority || 0)) + 1;
    addAllocation({
      id: Math.random().toString(36).substr(2, 9),
      book_id: bookId,
      class_id: activeTab,
      sessions_per_week: 1,
      priority: nextPriority
    });
  };

  const handleToggleSelection = (bookId: string) => {
    const newSelected = new Set(selectedBookIds);
    if (newSelected.has(bookId)) {
      newSelected.delete(bookId);
    } else {
      newSelected.add(bookId);
    }
    setSelectedBookIds(newSelected);
  };

  const handleAssignSelected = () => {
    if (activeTab === 'all') return;
    
    selectedBookIds.forEach(bookId => {
      if (!isAssignedToClass(bookId, activeTab)) {
        const nextPriority = Math.max(0, ...allocations.filter(a => a.class_id === activeTab).map(a => a.priority || 0)) + 1;
        addAllocation({
          id: Math.random().toString(36).substr(2, 9),
          book_id: bookId,
          class_id: activeTab,
          sessions_per_week: 1,
          priority: nextPriority
        });
      }
    });
    setSelectedBookIds(new Set());
  };

  const handleRemoveAllocation = (allocationId: string) => {
    deleteAllocation(allocationId);
  };

  const handleOpenModal = () => {
    setFormData({
      name: '',
      category: 'c_reading',
      level: '',
      total_units: 10,
      unit_type: 'unit',
      days_per_unit: 1,
      review_units: 0,
      total_sessions: 10
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    // 1. Validation
    if (!formData.name || formData.name.trim() === '') {
        alert('Book Name is required.');
        return;
    }
    if (!formData.category) {
        alert('Category is required.');
        return;
    }
    
    // Numeric validation
    const totalUnits = Number(formData.total_units);
    if (isNaN(totalUnits) || totalUnits <= 0) {
        alert('Total Units must be a positive number.');
        return;
    }

    const daysPerUnit = Number(formData.days_per_unit);
    if (isNaN(daysPerUnit) || daysPerUnit <= 0) {
        alert('Days per Unit must be a positive number.');
        return;
    }

    // Allow duplicates: no duplicate check

    try {
        // 2. Prepare Data
        const newBook: Book = {
            id: Math.random().toString(36).substr(2, 9),
            name: formData.name.trim(),
            category: formData.category,
            level: formData.level?.trim() || '',
            unit_type: formData.unit_type || 'unit',
            total_units: totalUnits,
            days_per_unit: daysPerUnit,
            review_units: Number(formData.review_units || 0),
            units: [] // Initialize empty units
        };

        // 3. Save
        addBook(newBook);
        
        // 4. Reset & Close
        setIsModalOpen(false);
        setFormData({
            name: '',
            category: 'c_reading',
            level: '',
            total_units: 10,
            unit_type: 'unit',
            days_per_unit: 1,
            review_units: 0,
            total_sessions: 10
        });

        // Feedback
        // alert('Book added successfully!'); 
    } catch (error) {
        console.error('Failed to add book:', error);
        alert('An error occurred while adding the book. Please try again.');
    }
  };

  const getUsedByText = (bookId: string) => {
    const usedClassIds = allocations
        .filter(a => a.book_id === bookId)
        .map(a => a.class_id);
    
    const uniqueClassIds = Array.from(new Set(usedClassIds));
    const usedClasses = uniqueClassIds
        .map(id => classes.find(c => c.id === id))
        .filter(c => c !== undefined);

    if (usedClasses.length === 0) return <span className="text-slate-400 text-sm italic">Not assigned</span>;

    const names = usedClasses.map(c => c!.name);
    if (names.length <= 3) {
        return (
            <div className="flex flex-wrap gap-1">
                {names.map(name => (
                    <span key={name} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium border border-indigo-100">
                        {name}
                    </span>
                ))}
            </div>
        );
    } else {
        return (
            <div className="flex flex-wrap gap-1 items-center">
                {names.slice(0, 3).map(name => (
                    <span key={name} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium border border-indigo-100">
                        {name}
                    </span>
                ))}
                <span className="text-xs text-slate-500 font-medium">+{names.length - 3} more</span>
            </div>
        );
    }
  };

  return (
    <Suspense fallback={<div className="p-12">Loading...</div>}>
    <div className="min-h-screen bg-slate-50 p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-light text-slate-900 tracking-tight mb-2">Book Database</h1>
            <p className="text-slate-500 font-light">Manage academic resources and lesson flows.</p>
          </div>
          <button 
            onClick={handleOpenModal}
            className="group flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" /> 
            <span className="text-sm font-medium">New Book</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
              activeTab === 'all'
                ? "bg-slate-900 text-white shadow-md" 
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            )}
          >
            All Books
          </button>
          
          <div className="h-6 w-px bg-slate-200 mx-1 flex-shrink-0" />

          {classes.map(cls => (
            <button
              key={cls.id}
              onClick={() => setActiveTab(cls.id)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                activeTab === cls.id 
                  ? "bg-indigo-600 text-white shadow-md" 
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
            >
              {cls.name}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        {activeTab === 'all' && (
          <div className="mb-8 relative max-w-lg">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search books..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-none rounded-xl shadow-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-shadow"
            />
          </div>
        )}

        {activeTab === 'all' ? (
          /* ALL BOOKS TABLE VIEW */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                          <th className="px-6 py-4">Name</th>
                          <th className="px-6 py-4 w-48">Course</th>
                          <th className="px-6 py-4 w-32 text-center">Sessions</th>
                          <th className="px-6 py-4 w-10"></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {filteredBooks.length > 0 ? (
                          filteredBooks.map((book) => (
                              <tr 
                                  key={book.id} 
                                  onClick={() => router.push(`/books/${book.id}`)}
                                  className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                              >
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                              <BookIcon className="h-5 w-5" />
                                          </div>
                                          <div>
                                              <div className="font-medium text-slate-900 group-hover:text-indigo-900 transition-colors">{book.name}</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <span className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                                          {CATEGORIES.find(c => c.id === book.category)?.label || book.category}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <span className="text-sm font-medium text-slate-700">
                                          {book.total_sessions || book.total_units}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                      <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-400" />
                                  </td>
                              </tr>
                          ))
                      ) : (
                          <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                  No books found.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
        ) : (
          /* CLASS ASSIGNMENT: SEARCH + ASSIGNED ONLY */
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <BookIcon className="h-4 w-4 text-slate-400" />
                  Search Books to add
                </h3>
              </div>
              <div className="p-4">
                <div className="mb-4 relative max-w-lg">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Search books by name or level..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-shadow"
                  />
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {limitedSearch.map(book => {
                    const assigned = isAssignedToClass(book.id, activeTab);
                    return (
                      <div
                        key={book.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
                            <BookIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 truncate">{book.name}</div>
                            <div className="text-xs text-slate-500">
                               {CATEGORIES.find(c => c.id === book.category)?.label || book.category} • {book.total_sessions || book.total_units} sessions
                            </div>
                          </div>
                        </div>
                        {assigned ? (
                          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">Assigned</span>
                        ) : (
                          <button
                            onClick={() => handleAddToClass(book.id)}
                            className="px-3 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-slate-400" />
                  Assigned to {classes.find(c => c.id === activeTab)?.name}
                </h3>
              </div>
              <div className="p-4 space-y-2">
                {getAssignedBooks(activeTab).length > 0 ? (
                  getAssignedBooks(activeTab).map(allocation => (
                    <div 
                      key={allocation.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                          <BookIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{allocation.book!.name}</div>
                          <div className="text-xs text-slate-500">
                             {allocation.book!.total_sessions || allocation.book!.total_units} sessions
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveAllocation(allocation.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove from class"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                    <BookIcon className="h-12 w-12 mb-3 opacity-20" />
                    <p>No books assigned yet.</p>
                    <p className="text-sm opacity-70">위 검색으로 추가하세요.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Simple Add Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-medium text-slate-900">Add New Book</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Book Name</label>
                  <input
                    placeholder="e.g. Reading Master 1"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Level</label>
                  <input
                    type="text"
                    value={formData.level || ''}
                    onChange={e => setFormData({...formData, level: e.target.value})}
                    className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent"
                    placeholder="e.g. G1, A1a"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unit Type</label>
                  <select
                    value={formData.unit_type}
                    onChange={e => setFormData({...formData, unit_type: e.target.value as UnitType})}
                    className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent"
                  >
                    <option value="unit">Unit</option>
                    <option value="day">Day</option>
                    <option value="lesson">Lesson</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total {formData.unit_type === 'day' ? 'Days' : 'Units'}
                  </label>
                  <input
                    type="number"
                    value={formData.total_units}
                    onChange={e => setFormData({...formData, total_units: parseInt(e.target.value)})}
                    className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Days Per Unit</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.days_per_unit || 1}
                    onChange={e => setFormData({...formData, days_per_unit: parseInt(e.target.value)})}
                    className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="px-6 py-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all"
                >
                  Create Book
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </Suspense>
  );
}
