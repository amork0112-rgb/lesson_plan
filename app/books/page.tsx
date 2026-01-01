'use client';

import { useState } from 'react';
import { useData } from '@/context/store';
import { Plus, Search, Book as BookIcon, X, ChevronRight, GraduationCap } from 'lucide-react';
import { Book, UnitType } from '@/types';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

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
  const { books, addBook, allocations, classes } = useData();
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

  const filteredBooks = books.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (b.level || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesTab = true;
    if (activeTab !== 'all') {
        const classBookIds = allocations
            .filter(a => a.class_id === activeTab)
            .map(a => a.book_id);
        matchesTab = classBookIds.includes(b.id);
    }
    
    return matchesSearch && matchesTab;
  });

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
    if (!formData.name || !formData.category) return;
    
    const newBook = {
        ...formData,
        id: Math.random().toString(36).substr(2, 9),
        total_units: Number(formData.total_units),
        review_units: Number(formData.review_units || 0),
        total_sessions: Number(formData.total_sessions || formData.total_units)
    } as Book;

    addBook(newBook);
    setIsModalOpen(false);
    
    // Optional: Redirect to new book detail immediately?
    // router.push(`/books/${newBook.id}`);
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
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-indigo-600 text-white shadow-md" 
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
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

        {/* Book List Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4 w-48">Course</th>
                        <th className="px-6 py-4 w-32 text-center">Sessions</th>
                        <th className="px-6 py-4 w-1/3">Used By</th>
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
                                            {book.level && <div className="text-xs text-slate-400">{book.level}</div>}
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
                                <td className="px-6 py-4">
                                    {getUsedByText(book.id)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-400" />
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                No books found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

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
  );
}