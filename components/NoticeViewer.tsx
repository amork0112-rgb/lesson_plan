'use client';

import { FileText, Image as ImageIcon, Paperclip, Download, ExternalLink } from 'lucide-react';
import { Post } from '@/types';

interface NoticeViewerProps {
  notice: Post;
}

export function NoticeViewer({ notice }: NoticeViewerProps) {
  const getAttachmentIcon = (type?: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="w-4 h-4 text-red-500" />;
      case "image":
        return <ImageIcon className="w-4 h-4 text-green-500" />;
      default:
        return <Paperclip className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{notice.title}</h3>
          {notice.attachment_url && (
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
              {getAttachmentIcon(notice.attachment_type)}
              <span className="font-medium">첨부파일 있음</span>
            </div>
          )}
        </div>
        <div className="text-xs text-slate-400">
            {notice.created_at ? new Date(notice.created_at).toLocaleDateString() : ''}
        </div>
      </div>

      <div className="prose prose-slate max-w-none text-slate-600 mb-6 whitespace-pre-line">
        {notice.content}
      </div>

      {/* Attachments Action Area */}
      {notice.attachment_url && (
        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
          {/* Preview Button (PDF only usually, but browser handles most) */}
          <a
            href={notice.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            {notice.attachment_type === 'pdf' ? <FileText className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
            미리보기
          </a>

          {/* Download Button */}
          <a
            href={notice.attachment_url}
            download
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            다운로드
          </a>
        </div>
      )}
    </div>
  );
}
