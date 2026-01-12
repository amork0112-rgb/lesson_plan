'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Book } from '@/types';
import { Upload } from 'lucide-react';
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

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) return;
      const { data: courses } = await supabase.from('courses').select('*');
      if (Array.isArray(courses)) {
        const arr = courses as any[];
        const sorted = [...arr].sort((a, b) => {
          const an = (a.name || a.level || '').toString().toLowerCase();
          const bn = (b.name || b.level || '').toString().toLowerCase();
          return an.localeCompare(bn);
        });
        setRows(sorted as any);
      }
      const { data: bks } = await supabase.from('books').select('*').order('name', { ascending: true });
      if (Array.isArray(bks)) setBooks(bks as any);
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
        if (Array.isArray(bks)) setBooks(bks as any);
      }
      alert(`Books imported: ${candidates.length}`);
      router.push('/books');
    };
    importBooks();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light text-slate-900 tracking-tight">Courses</h1>
            <p className="text-slate-500 font-light">Supabase의 레벨별 커리큘럼을 조회하고 Books를 생성합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportToBooks}
              className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
            >
              <Upload className="h-4 w-4 inline mr-1" /> Books에 반영
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r, idx) => (
                <tr key={idx} className="align-top">
                  {(['level','duration','mainTB','secondTB','speaking','voca','grammar','writing','certify'] as (keyof CurriculumRow)[])
                    .map((key) => (
                      <td key={key as string} className="px-3 py-2">
                        <div className="text-sm text-slate-800 whitespace-pre-line">
                          {Array.isArray(r[key]) ? (r[key] as string[]).join('\n') : (r[key] as string)}
                        </div>
                      </td>
                    ))
                  }
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
