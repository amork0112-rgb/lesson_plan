'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Plus, Save } from 'lucide-react';

type Notice = {
  id?: string;
  org_key: string;
  title: string;
  content: string;
  author_email?: string;
  created_at?: string;
};

export default function NoticesPage() {
  const supabase = getSupabase();
  const orgKey = process.env.NEXT_PUBLIC_ORG_KEY || 'frage';
  const [notices, setNotices] = useState<Notice[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const canUseRemote = !!supabase;

  const load = async () => {
    if (!canUseRemote) return;
    setLoading(true);
    const { data, error } = await supabase!
      .from('notices')
      .select('*')
      .eq('org_key', orgKey)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setNotices(data as Notice[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!title.trim() || !content.trim()) return;
    if (!canUseRemote) {
      alert('Supabase 설정이 필요합니다. 환경변수를 설정하세요.');
      return;
    }
    setLoading(true);
    const payload: Notice = { org_key: orgKey, title: title.trim(), content: content.trim(), author_email: email.trim() || undefined };
    const { data, error } = await supabase!.from('notices').insert(payload).select();
    if (!error && data) {
      setNotices([data[0] as Notice, ...notices]);
      setTitle('');
      setContent('');
      setEmail('');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light text-slate-900 tracking-tight">Notices</h1>
            <p className="text-slate-500 font-light">조직 공지를 계정과 무관하게 공유합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className={cn("px-4 py-2 rounded-full text-sm font-medium", loading ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800")}
            >
              새로고침
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">공지 목록</h2>
                <span className="text-xs text-slate-500">{notices.length}개</span>
              </div>
              <div className="p-6 space-y-4">
                {loading && <div className="text-slate-400 text-sm">불러오는 중...</div>}
                {!loading && notices.length === 0 && (
                  <div className="text-slate-400 text-sm">등록된 공지가 없습니다.</div>
                )}
                {!loading && notices.map(n => (
                  <div key={n.id || `${n.title}-${n.created_at}`} className="p-4 rounded-xl border border-slate-100 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="text-base font-semibold text-slate-900">{n.title}</div>
                      <div className="text-xs text-slate-400">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-700 whitespace-pre-line">{n.content}</div>
                    <div className="mt-2 text-xs text-slate-400">{n.author_email || ''}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">공지 작성</h2>
              </div>
              <div className="p-6 space-y-4">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="제목"
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm"
                />
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="내용"
                  rows={6}
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="작성자 이메일(선택)"
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm"
                />
                <button
                  onClick={handleAdd}
                  disabled={loading || !title.trim() || !content.trim()}
                  className={cn("w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium",
                    loading ? "bg-slate-200 text-slate-500" : "bg-indigo-600 text-white hover:bg-indigo-700")}
                >
                  <Plus className="h-4 w-4" /> 등록
                </button>
                {!canUseRemote && (
                  <div className="text-xs text-red-600">
                    환경변수 설정이 필요합니다: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_ORG_KEY
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

