'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Book } from '@/types';
import { Upload, Save, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type CurriculumRow = {
  id?: string;
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
  const supabase = getSupabase();
  const [rows, setRows] = useState<CurriculumRow[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const router = useRouter();
  const [editing, setEditing] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) return;
      const { data: courses } = await supabase.from('courses').select('*');
      if (Array.isArray(courses)) {
        const arr = courses as CurriculumRow[];
        const sorted = [...arr].sort((a, b) => {
          const an = (a.level || a.mainTB || '').toString().toLowerCase();
          const bn = (b.level || b.mainTB || '').toString().toLowerCase();
          return an.localeCompare(bn);
        });
        setRows(sorted);
      }
      const { data: bks } = await supabase.from('books').select('*').order('name', { ascending: true });
      if (Array.isArray(bks)) setBooks(bks as Book[]);
    };
    fetchData();
  }, [supabase]);

  const existingKey = (b: Book) => `${(b.level || '').toLowerCase()}::${b.name.toLowerCase()}`;
  const existingSet = useMemo(() => new Set(books.map(existingKey)), [books]);

  const handleImportToBooks = () => {
    const candidates: Book[] = [];
    rows.forEach(r => {
      const level = r.level.trim();
      if (!level) return;
      const pushOne = (name?: string, category?: string) => {
        if (!name || !name.trim()) return;
        const normalizedName = name.trim().toLowerCase();
        const normalizedLevel = level.toLowerCase();
        const existing = books.find(b => (b.level || '').trim().toLowerCase() === normalizedLevel && b.name.trim().toLowerCase() === normalizedName);
        if (!existing) {
          const book = toBook(level, name, category!);
          const key = existingKey(book);
          if (!existingSet.has(key)) {
            candidates.push(book);
          }
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
    const importBooks = async () => {
      if (!supabase) return;
      if (candidates.length > 0) {
        await supabase.from('books').upsert(candidates);
        const { data: bks } = await supabase.from('books').select('*').order('name', { ascending: true });
        if (Array.isArray(bks)) setBooks(bks as Book[]);
      }
      alert(`Books imported: ${candidates.length}`);
      router.push('/books');
    };
    importBooks();
  };

  const setCell = (idx: number, key: keyof CurriculumRow, value: string) => {
    const next = [...rows];
    if (key === 'secondTB') {
      const arr = value.split('/').map(v => v.trim()).filter(Boolean);
      next[idx] = { ...next[idx], secondTB: arr };
    } else {
      next[idx] = { ...next[idx], [key]: value };
    }
    setRows(next);
  };

  const handleAddRow = () => {
    setRows([
      ...rows,
      { id: undefined, level: '', duration: '3', mainTB: '' }
    ]);
  };

  const handleDeleteRow = async (idx: number) => {
    const target = rows[idx];
    if (supabase && target?.id) {
      await supabase.from('courses').delete().eq('id', target.id);
    }
    const next = [...rows];
    next.splice(idx, 1);
    setRows(next);
  };

  const handleSaveRows = async () => {
    if (!supabase) return;
    const payload = rows.map(r => ({
      id: r.id,
      level: r.level?.trim() || '',
      duration: r.duration?.trim() || '',
      mainTB: r.mainTB || '',
      secondTB: Array.isArray(r.secondTB) ? r.secondTB : (r.secondTB ? r.secondTB.split('/').map(v => v.trim()).filter(Boolean) : []),
      speaking: r.speaking || '',
      voca: r.voca || '',
      grammar: r.grammar || '',
      writing: r.writing || '',
      certify: r.certify || ''
    }));
    await supabase.from('courses').upsert(payload);
    const { data: courses } = await supabase.from('courses').select('*');
    if (Array.isArray(courses)) {
      const arr = courses as CurriculumRow[];
      const sorted = [...arr].sort((a, b) => {
        const an = (a.level || a.mainTB || '').toString().toLowerCase();
        const bn = (b.level || b.mainTB || '').toString().toLowerCase();
        return an.localeCompare(bn);
      });
      setRows(sorted);
    }
    alert('Courses 저장 완료');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light text-slate-900 tracking-tight">Courses</h1>
            <p className="text-slate-500 font-light">엑셀처럼 편집하고 저장, Books로 반영합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(!editing)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${editing ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
            >
              <Pencil className="h-4 w-4 inline mr-1" /> {editing ? '편집 종료' : '편집'}
            </button>
            <button
              onClick={handleSaveRows}
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
                <th className="px-3 py-4">Writing</th>
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
