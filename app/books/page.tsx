'use client';

import { useState } from 'react';
import { useData } from '@/context/store';
import { Plus, Trash2, Search, Book as BookIcon, ChevronRight, X, Edit2, List } from 'lucide-react';
import { Book, UnitType, LessonUnit } from '@/types';
import { cn } from '@/lib/utils';
import { generateBookUnits } from '@/lib/logic';

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
  const { books, addBook, updateBook, deleteBook } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('c_reading');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  
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
    const isOther = !CATEGORIES.slice(0, 6).find(c => c.id === b.category);
    const matchesTab = activeTab === 'others' ? isOther : b.category === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleOpenModal = (book?: Book) => {
    if (book) {
      setEditingBookId(book.id);
      setFormData({ ...book });
    } else {
      setEditingBookId(null);
      setFormData({
        name: '',
        category: activeTab === 'others' ? 'c_reading' : activeTab,
        level: '',
        total_units: 10,
        unit_type: 'unit',
        review_units: 0,
        total_sessions: 10
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenDetail = (book: Book) => {
    setSelectedBook(book);
    setIsDetailOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.category) return;
    
    const bookData = {
        ...formData,
        total_units: Number(formData.total_units),
        review_units: Number(formData.review_units || 0),
        total_sessions: Number(formData.total_sessions || formData.total_units)
    } as Book;

    if (editingBookId) {
      updateBook(editingBookId, bookData);
    } else {
      addBook({
        ...bookData,
        id: Math.random().toString(36).substr(2, 9),
      });
    }
    setIsModalOpen(false);
  };

  const getCategoryName = (id: string) => CATEGORIES.find(c => c.id === id)?.label || id;

  return (
    <div className="min-h-screen bg-slate-50 p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-light text-slate-900 tracking-tight mb-2">Book Database</h1>
            <p className="text-slate-500 font-light">Manage academic resources and materials.</p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="group flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" /> 
            <span className="text-sm font-medium">New Book</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                activeTab === cat.id 
                  ? "bg-indigo-600 text-white shadow-md" 
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="mb-10 relative max-w-lg">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search books..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-shadow"
          />
        </div>

        {/* Detail Panel */}
        {isDetailOpen && selectedBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/20 backdrop-blur-sm">
             <div className="bg-white h-full w-full max-w-md shadow-2xl p-0 animate-in slide-in-from-right duration-300 flex flex-col">
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                   <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{selectedBook.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                         <span>Total Sessions: {selectedBook.total_sessions}</span>
                         {selectedBook.review_units ? <span>(+ Reviews)</span> : null}
                      </div>
                   </div>
                   <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors">
                      <X className="h-5 w-5" />
                   </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                   {generateBookUnits(selectedBook).map((unit, idx) => (
                      <div key={unit.id || idx} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors">
                         <div className={`
                            h-5 w-5 rounded border flex items-center justify-center text-xs flex-shrink-0
                            ${unit.type === 'lesson' ? 'border-indigo-200 text-indigo-600 bg-indigo-50' : 'border-amber-200 text-amber-600 bg-amber-50'}
                         `}>
                            {/* Checkmark placeholder or type icon */}
                            {unit.type === 'review' ? '★' : '✓'}
                         </div>
                         <div className="flex-1">
                            {unit.type === 'lesson' ? (
                               <div className="text-sm font-medium text-slate-700">
                                  {unit.title}
                               </div>
                            ) : (
                               <div className="text-sm font-bold text-amber-600 flex items-center gap-2">
                                  ⭐ {unit.title}
                               </div>
                            )}
                         </div>
                         <div className="text-xs text-slate-400 font-mono">
                            #{unit.sequence}
                         </div>
                      </div>
                   ))}
                </div>
                
                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    <button 
                       onClick={() => {
                          setIsDetailOpen(false);
                          handleOpenModal(selectedBook);
                       }}
                       className="w-full py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                       Edit Configuration
                    </button>
                </div>
             </div>
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-medium text-slate-900">
                  {editingBookId ? 'Edit Book' : 'Add New Book'}
                </h3>
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
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Review Sessions</label>
                  <input
                    type="number"
                    value={formData.review_units}
                    onChange={e => setFormData({...formData, review_units: parseInt(e.target.value)})}
                    className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Sessions (Calculated/Manual)</label>
                  <input
                    type="number"
                    value={formData.total_sessions}
                    onChange={e => setFormData({...formData, total_sessions: parseInt(e.target.value)})}
                    className="w-full border-b border-slate-200 py-2 focus:border-slate-900 focus:outline-none bg-transparent font-medium"
                  />
                  <p className="text-xs text-slate-400">Usually matches total units + review sessions.</p>
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
                  {editingBookId ? 'Update Book' : 'Save Book'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Book List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBooks.map((book) => (
            <div 
              key={book.id} 
              onClick={() => handleOpenDetail(book)}
              className="group bg-white rounded-2xl p-6 border border-slate-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 transition-all duration-300 cursor-pointer relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                  <BookIcon className="h-6 w-6" />
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                   <button 
                     onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(book);
                     }}
                     className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full hover:bg-indigo-100"
                   >
                     Edit
                   </button>
                </div>
              </div>
              
              <h4 className="text-lg font-medium text-slate-900 mb-2 group-hover:text-indigo-900 transition-colors">{book.name}</h4>
              
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{getCategoryName(book.category || '')}</span>
                {book.level && <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">{book.level}</span>}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Units/Days</span>
                  <span className="font-medium text-slate-700">{book.total_units} {book.unit_type}s</span>
                </div>
                <div className="flex justify-between text-sm">
                   <span className="text-slate-500">Review</span>
                   <span className="font-medium text-slate-700">{book.review_units || 0}</span>
                </div>
                <div className="pt-2 border-t border-slate-50 flex justify-between text-sm">
                   <span className="text-slate-500">Total Sessions</span>
                   <span className="font-bold text-slate-900">{book.total_sessions || book.total_units}</span>
                </div>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  deleteBook(book.id);
                }}
                className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          
          {filteredBooks.length === 0 && (
            <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
              <p className="text-slate-400">No books found in this category.</p>
              <button 
                onClick={() => handleOpenModal()}
                className="mt-4 text-indigo-600 font-medium hover:underline"
              >
                Add a new book
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
