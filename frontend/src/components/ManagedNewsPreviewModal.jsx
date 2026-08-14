import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Building2, ExternalLink, Eye } from 'lucide-react';
import { API_BASE } from '../api/client';

const CATEGORY_LABELS = {
  wia: '위아 뉴스',
  external: '외부 뉴스',
  bp: 'BP 사례',
};

const formatViewCount = (value) => Number(value || 0).toLocaleString('ko-KR');

export default function ManagedNewsPreviewModal({ news, isLoading, onClose }) {
  return (
    <div className="news-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <article className="news-modal" role="dialog" aria-modal="true" aria-label="Tech News 미리보기" onMouseDown={(event) => event.stopPropagation()}>
        <button className="news-modal-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
        {isLoading ? (
          <div className="news-empty">게시글을 불러오는 중입니다.</div>
        ) : (
          <>
            <div className="news-detail-head">
              <div className="news-detail-meta">
                <span className={'news-category ' + news.category}>{CATEGORY_LABELS[news.category] || 'AI Tech News'}</span>
                {news.category === 'bp' && news.org_name && <span className="news-org-meta"><Building2 size={13} />{news.org_name}</span>}
                <span>{news.created_at.slice(0, 10)}</span>
                <span className="news-view-count"><Eye size={14} />{formatViewCount(news.view_count)}</span>
              </div>
              <h2>{news.title}</h2>
            </div>
            {news.cover_image_url && <div className="news-modal-cover-frame"><img className="news-modal-cover" src={API_BASE + news.cover_image_url} alt="" /></div>}
            {news.category === 'external' && news.source_url && (
              <div className="news-source-link-row">
                <a className="news-source-link" href={news.source_url} target="_blank" rel="noreferrer">
                  <span className="news-source-link-icon"><ExternalLink size={17} /></span>
                  <span className="news-source-link-copy"><small>ORIGINAL SOURCE</small><b>외부 원문 기사 보기</b><em>{news.source_url}</em></span>
                </a>
              </div>
            )}
            <div className="markdown-report"><ReactMarkdown remarkPlugins={[remarkGfm]}>{news.markdown || ''}</ReactMarkdown></div>
          </>
        )}
      </article>
    </div>
  );
}
