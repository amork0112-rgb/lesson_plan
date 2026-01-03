'use client';

import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/context/store';
import { Book } from '@/types';
import { cn } from '@/lib/utils';
import { Plus, Save, Upload, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type CurriculumRow = {
  level: string;
  duration: string;
  mainTB?: string;
  secondTB?: string | string[];
  speaking?: string;
  voca?: string;
  grammar?: string;
  writing?: string;
  certify?: string;
};

const INITIAL_ROWS: CurriculumRow[] = [
  { level: 'G1', duration: '3', mainTB: 'Phonics Show 1/ Readers', speaking: 'I can speak English  S1' },
  { level: 'G2', duration: '3', mainTB: 'Phonics  Friends 2', speaking: 'I can speak English S 2', voca: 'Voca point 1' },
  { level: 'G3', duration: '3', mainTB: 'Phonics Show 4', speaking: 'I can speak English  1', voca: 'Voca point 2' },
  { level: 'A1a', duration: '3', mainTB: 'WS Starter 1', speaking: 'I can speak English  2', voca: 'Voca point 3' },
  { level: 'A1a', duration: '3', mainTB: 'WS Starter 3', speaking: 'I can speak English  3', voca: 'Voca point 4' },
  { level: 'A1b', duration: '3', mainTB: 'WS Basic 2', secondTB: ['Tropy 9 1C1','Tropy 9 1C2'], speaking: 'Everyone Speak Kids 3', voca: '200words 3', certify: 'Red' },
  { level: 'A1b', duration: '3', mainTB: 'WS Basic 3', secondTB: ['Tropy 9 1C3','Tropy 9 2A1'] },
  { level: 'A2a', duration: '3', mainTB: 'All new very \nesay true stories', secondTB: ['Tropy 9 2A3','Tropy 9 2B1'], grammar: 'Grammar point 1', writing: '5W1H', certify: 'orange' },
  { level: 'A2a', duration: '3', mainTB: 'WS  Intermediate 1', secondTB: ['Tropy 9 2B3','Tropy 9 2C1'], grammar: 'Grammar point 2', writing: 'tense writing 1-1' },
  { level: 'A2b', duration: '3', mainTB: 'WS  Intermediate 2', secondTB: ['Tropy 9 2C3','Tropy 9 3A1'], grammar: 'Grammar point 3', writing: 'paragrah writing', certify: 'Yellow' },
  { level: 'A2b', duration: '3', mainTB: 'WS  Intermediate 3', secondTB: ['Tropy 9 3A3','Tropy 9 3B1'], grammar: 'Grammar point 4', writing: 'tense writing 2-1' },
  { level: 'A3a', duration: '3', mainTB: 'True stories 1B', secondTB: ['Tropy 9 3B2','Tropy 9 3C1'], grammar: 'Aha Grammar 2 \n(My First Grammar 2)', writing: 'Andover Writing 1', certify: 'Green' },
  { level: 'A3a', duration: '3', mainTB: 'Our world 4A', secondTB: ['Tropy 9 3C2','Tropy 9 3C3'] },
  { level: 'A3b', duration: '3', mainTB: 'Subject link 4', secondTB: ['Tropy 9 4A1','Tropy 9 4A2'], grammar: 'Aha Grammar 3 \n(My First Grammar 3)', writing: 'Andover Writing 2', certify: 'Blue' },
  { level: 'A3b', duration: '3', mainTB: 'Our world 5A', secondTB: ['Tropy 9 4A3','Tropy 9 4B1'] },
  { level: 'A4a', duration: '3', mainTB: 'Reading Juice Plus 1', secondTB: ['Tropy 9 4B2','Tropy 9 4B3'], grammar: 'My next Grammar 1 \n(Gramamr Success1)', writing: 'Andover Writing 3', certify: 'Indigo' },
  { level: 'A4a', duration: '3', mainTB: 'Brick Reading 300-2', secondTB: ['Tropy 9 4C1','Tropy 9 4C2'] },
  { level: 'A4b', duration: '3', mainTB: 'Ted Talks 21st 1', secondTB: ['Tropy 9 4C3','Tropy 9 4C2'], grammar: 'My next Grammar 2 \n(Gramamr Success1)', writing: 'Andover Writing 4', certify: 'Purple' },
  { level: 'A4b', duration: '3', mainTB: 'Junior Debate Starter \n+ Reading Success 3', secondTB: ['Tropy 9 5A1','Tropy 9 5A2'] },
  { level: 'A5', duration: '3', mainTB: 'Reading Juice Plus 3', secondTB: ['Tropy 9 5A3','Tropy 9 5B1'], speaking: 'M원리 / CS', grammar: 'My next Grammar 3 \n(Gramamr Success1)', writing: 'Creative Journal 1' },
  { level: 'A5', duration: '3', mainTB: 'My First Chapter Books \n(4 Books)', secondTB: ['Tropy 9 5B2','Tropy 9 5B3'] },
  { level: 'F1', duration: '3', mainTB: 'Into reading 3.1', voca: 'voca & into  (에듀스프링)', grammar: 'Grammar Engine 1', writing: 'Creative Journal 1' },
  { level: 'F1', duration: '3', voca: 'voca & into  (에듀스프링)' },
  { level: 'F2', duration: '3', mainTB: 'Into reading 3.3', secondTB: 'My First Chapter Books', voca: 'voca & into  (에듀스프링)', grammar: 'Grammar Engine 2', writing: 'Creative Journal 2' },
  { level: 'F2', duration: '3', voca: 'voca & into  (에듀스프링)' },
  { level: 'F3', duration: '3', mainTB: 'Into reading 4.1', secondTB: 'AMI Presentation Starter \n+Reading Success 4)', voca: 'voca & into  (에듀스프링)', grammar: 'Grammar Engine 3' },
  { level: 'F3', duration: '3', voca: 'voca & into  (에듀스프링)' },
  { level: 'M1A', duration: '3', mainTB: 'Subject link 5', secondTB: 'Social Studies \n& Science (5Gr+6Gr)', speaking: 'M원리 / CS', voca: 'voca (에듀스프링)', grammar: 'Grammar inside1', writing: 'Masters Journal 1' },
  { level: 'M1A', duration: '3', mainTB: 'Reading for Today 1 \n Themes', speaking: 'M원리', voca: 'voca (에듀스프링)' },
  { level: 'M1B', duration: '3', mainTB: 'Chapter Books (4 Books)', speaking: 'M원리', voca: 'voca (에듀스프링)', grammar: '중학 영문법 3800제 1', writing: 'Masters Journal 2' },
  { level: 'M1B', duration: '3', mainTB: '<Docu-English> \n Reading Explorer \n Foundation', speaking: 'M원리', voca: 'voca (에듀스프링)' },
  { level: 'M2A', duration: '3', mainTB: 'Reading for Today 2 \n insights ', secondTB: 'English Newspaper \n Articles \n (the Teen Times)', speaking: 'M원리', voca: 'voca (에듀스프링)', grammar: 'Grammar inside2', writing: 'Masters Journal 3' },
  { level: 'M2A', duration: '3', mainTB: '<Docu-English> \n Reading Explorer 1 ', speaking: 'M원리', voca: 'voca (에듀스프링)' },
  { level: 'M2B', duration: '3', mainTB: 'Novels (3 Books)', secondTB: 'English Newspaper \n Articles \n (the Teen Times)', speaking: 'M원리', voca: 'voca (에듀스프링)', grammar: '중학 영문법 3800제 2', writing: 'Masters Journal 4' },
  { level: 'M2B', duration: '3', mainTB: '<Docu-English> \n Reading Explorer 2', speaking: 'M원리', voca: 'voca (에듀스프링)' },
  { level: 'M3A', duration: '3', mainTB: 'What I believe 1', secondTB: 'The Korea Times', speaking: 'M원리', voca: 'voca (에듀스프링)', grammar: 'Grammar inside 3', writing: 'Essay Writing 1' },
  { level: 'M3A', duration: '3', mainTB: 'Reading Explorer 3', speaking: 'M원리', voca: 'voca (에듀스프링)' },
  { level: 'M3B', duration: '3', mainTB: 'Novels (2 Books)', speaking: 'M원리', voca: 'voca (에듀스프링)', grammar: '중학 영문법 3800제 3', writing: 'Essay Writing 2' },
  { level: 'M3B', duration: '3', mainTB: 'Reading for Today 3 \n Issues', speaking: 'M원리', voca: 'voca (에듀스프링)' },
];

function parseUnits(name: string): { total_units: number; unit_type: 'unit' | 'day' } {
  const uMatch = name.match(/\((\d+)\s*u\)/i);
  if (uMatch) return { total_units: parseInt(uMatch[1], 10), unit_type: 'unit' };
  const booksMatch = name.match(/\((\d+)\s*Books?\)/i);
  if (booksMatch) return { total_units: parseInt(booksMatch[1], 10), unit_type: 'unit' };
  if (/tropy\s*9|trophy\s*9/i.test(name)) return { total_units: 16, unit_type: 'day' };
  if (/200words/i.test(name)) return { total_units: 10, unit_type: 'day' };
  return { total_units: 10, unit_type: 'unit' };
}

function toBook(level: string, name: string, category: string): Book {
  const { total_units, unit_type } = parseUnits(name);
  const id = `b_${level.toLowerCase()}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`.replace(/_+/g, '_').replace(/^_|_$/g, '');
  return {
    id,
    name: name.trim(),
    category,
    level,
    series: (/tropy\s*9|trophy\s*9/i.test(name)) ? 'Trophy 9' : undefined,
    progression_type: (/tropy\s*9|trophy\s*9/i.test(name)) ? 'volume-day' : undefined,
    volume_count: (/tropy\s*9|trophy\s*9/i.test(name)) ? 4 : undefined,
    days_per_volume: (/tropy\s*9|trophy\s*9/i.test(name)) ? 4 : undefined,
    series_level: ((name.match(/trop\w*\s*9\s*([0-9A-Za-z]+)/i)?.[1]) || undefined),
    total_units,
    unit_type,
  };
}

export default function CoursesPage() {
  const { books, allocations, addBook, classes, addAllocation } = useData();
  const [rows, setRows] = useState<CurriculumRow[]>(INITIAL_ROWS);
  const [editing, setEditing] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('lesson_plan_curriculum');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRows(parsed);
      } catch {}
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('lesson_plan_curriculum', JSON.stringify(rows));
  };

  const handleAddRow = () => {
    setRows([...rows, { level: '', duration: '3', mainTB: '' }]);
  };

  const handleDeleteRow = (index: number) => {
    const next = [...rows];
    next.splice(index, 1);
    setRows(next);
  };

  const existingKey = (b: Book) => `${(b.level || '').toLowerCase()}::${b.name.toLowerCase()}`;
  const existingSet = useMemo(() => new Set(books.map(existingKey)), [books]);

  const handleImportToBooks = () => {
    const candidates: Book[] = [];
    const newAllocations: { bookId: string; classId: string }[] = [];
    rows.forEach(r => {
      const level = r.level.trim();
      if (!level) return;
      const pushOne = (name?: string, category?: string) => {
        if (!name || !name.trim()) return;
        const normalizedName = name.trim().toLowerCase();
        const normalizedLevel = level.toLowerCase();
        const existing = books.find(b => (b.level || '').trim().toLowerCase() === normalizedLevel && b.name.trim().toLowerCase() === normalizedName);
        let bookId = existing?.id;
        if (!existing) {
          const book = toBook(level, name, category!);
          const key = existingKey(book);
          if (!existingSet.has(key)) {
            candidates.push(book);
          }
          bookId = book.id;
        }
        const targetClass = classes.find(c => c.name.trim().toLowerCase() === normalizedLevel);
        if (targetClass && bookId) {
          const dup = allocations.some(a => a.class_id === targetClass.id && a.book_id === bookId);
          if (!dup) newAllocations.push({ bookId, classId: targetClass.id });
        }
      };
      const pushMany = (names?: string | string[], category?: string) => {
        if (!names) return;
        if (Array.isArray(names)) {
          names.forEach(n => pushOne(n, category));
        } else {
          pushOne(names, category);
        }
      };
      pushOne(r.mainTB, 'c_reading');
      pushMany(r.secondTB, 'c_reading');
      pushOne(r.speaking, 'c_speaking');
      pushOne(r.voca, 'c_voca');
      pushOne(r.grammar, 'c_grammar');
      pushOne(r.writing, 'c_writing');
      if (r.certify) pushOne(`SCP ${r.certify}`, 'c_speaking');
    });
    candidates.forEach(addBook);
    newAllocations.forEach(({ bookId, classId }, idx) => {
      addAllocation({
        id: Math.random().toString(36).slice(2),
        book_id: bookId,
        class_id: classId,
        sessions_per_week: 1,
        priority: idx + 1
      });
    });
    alert(`Books imported: ${candidates.length}`);
    router.push('/books');
  };

  const setCell = (idx: number, key: keyof CurriculumRow, value: string) => {
    const next = [...rows];
    next[idx] = { ...next[idx], [key]: value };
    setRows(next);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light text-slate-900 tracking-tight">Courses</h1>
            <p className="text-slate-500 font-light">레벨별 커리큘럼 표를 편집하고, Book DB로 반영합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(!editing)}
              className={cn("px-4 py-2 rounded-full text-sm font-medium border transition-all",
                editing ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100")}
            >
              <Pencil className="h-4 w-4 inline mr-1" /> {editing ? '편집 종료' : '편집'}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-full text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-all"
            >
              <Save className="h-4 w-4 inline mr-1" /> 저장
            </button>
            <button
              onClick={handleImportToBooks}
              className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
            >
              <Upload className="h-4 w-4 inline mr-1" /> Books에 반영
            </button>
            <button
              onClick={handleAddRow}
              className="px-4 py-2 rounded-full text-sm font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition-all"
            >
              <Plus className="h-4 w-4 inline mr-1" /> 행 추가
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="px-3 py-4">Level</th>
                <th className="px-3 py-4">duration</th>
                <th className="px-3 py-4">Main TB</th>
                <th className="px-3 py-4">Second TB</th>
                <th className="px-3 py-4">Speaking</th>
                <th className="px-3 py-4">Voca</th>
                <th className="px-3 py-4">Grammar</th>
                <th className="px-3 py-4">Writing [A]</th>
                <th className="px-3 py-4">스피킹인증제</th>
                <th className="px-3 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r, idx) => (
                <tr key={idx} className="align-top">
                  {(['level','duration','mainTB','secondTB','speaking','voca','grammar','writing','certify'] as (keyof CurriculumRow)[])
                    .map((key) => (
                      <td key={key as string} className="px-3 py-2">
                        {editing ? (
                          <textarea
                            value={(Array.isArray(r[key]) ? (r[key] as string[]).join(' / ') : (r[key] || '') as string)}
                            onChange={(e) => setCell(idx, key, e.target.value)}
                            rows={key === 'level' || key === 'duration' ? 1 : 2}
                            className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white"
                          />
                        ) : (
                          <div className="text-sm text-slate-800 whitespace-pre-line">{Array.isArray(r[key]) ? (r[key] as string[]).join('\n') : (r[key] as string)}</div>
                        )}
                      </td>
                    ))
                  }
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDeleteRow(idx)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
