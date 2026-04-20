'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

/**
 * Cmd+K / Ctrl+K ile açılan global arama.
 * Projeler, kullanıcılar ve belgeler içinde arama yapar.
 */

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Cmd+K / Ctrl+K klavye kısayolu
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Açılınca inputa odaklan
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery(''); setResults(null);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (!query || query.length < 2) { setResults(null); return; }
    setLoading(true);
    const t = setTimeout(() => {
      api.get('/search', { params: { q: query, limit: 5 } })
        .then(r => setResults(r.data))
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  const go = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: '#f0ede8', color: '#6b7280', border: '1px solid #e8e4dc' }}
        aria-label="Global arama">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Ara...</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: '#d4cfc7' }}>⌘K</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      style={{ background: 'rgba(15, 36, 68, 0.4)', backdropFilter: 'blur(3px)' }}
      onClick={() => setOpen(false)}>
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ border: '1px solid #e8e4dc' }}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#f0ede8' }}>
          <svg className="w-5 h-5 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input ref={inputRef}
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Proje, kullanıcı, belge ara..."
            className="flex-1 text-base outline-none bg-transparent"
            autoComplete="off" />
          {loading && <div className="w-4 h-4 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />}
          <button onClick={() => setOpen(false)} className="text-muted hover:text-navy text-sm font-mono px-2 py-0.5 rounded border"
            style={{ borderColor: '#e8e4dc' }}>
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!query || query.length < 2 ? (
            <div className="p-6 text-center text-sm text-muted">
              En az 2 karakter yazın...
              <div className="mt-3 flex justify-center gap-2 flex-wrap text-xs">
                <span className="px-2 py-1 rounded" style={{ background: '#f0ede8' }}>proje başlığı</span>
                <span className="px-2 py-1 rounded" style={{ background: '#f0ede8' }}>hoca adı</span>
                <span className="px-2 py-1 rounded" style={{ background: '#f0ede8' }}>belge adı</span>
              </div>
            </div>
          ) : !results || (!results.projects.length && !results.users.length && !results.documents.length) ? (
            <div className="p-6 text-center text-sm text-muted">
              {loading ? 'Aranıyor...' : 'Sonuç bulunamadı'}
            </div>
          ) : (
            <div className="p-2">
              {/* Projeler */}
              {results.projects.length > 0 && (
                <Section title={`Projeler (${results.totals.projects})`}>
                  {results.projects.map((p: any) => (
                    <Row key={p.id} onClick={() => go(`/projects/${p.id}`)}
                      icon={<svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>}
                      title={p.title}
                      subtitle={[p.faculty, p.snippet].filter(Boolean).join(' · ')}
                      badge={p.status} />
                  ))}
                </Section>
              )}

              {/* Kullanıcılar */}
              {results.users.length > 0 && (
                <Section title={`Kullanıcılar (${results.totals.users})`}>
                  {results.users.map((u: any) => (
                    <Row key={u.id} onClick={() => go(`/users/${u.id}`)}
                      icon={<svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>}
                      title={u.name}
                      subtitle={[u.faculty, u.email].filter(Boolean).join(' · ')}
                      badge={u.role} />
                  ))}
                </Section>
              )}

              {/* Belgeler */}
              {results.documents.length > 0 && (
                <Section title={`Belgeler (${results.totals.documents})`}>
                  {results.documents.map((d: any) => (
                    <Row key={d.id} onClick={() => go(`/projects/${d.projectId}`)}
                      icon={<svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>}
                      title={d.name}
                      subtitle={d.projectTitle} />
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>

        {/* Alt bilgi */}
        <div className="px-4 py-2 border-t text-xs text-muted flex items-center justify-between"
          style={{ borderColor: '#f0ede8', background: '#faf8f4' }}>
          <span>Tüm sistem üzerinde arama</span>
          <span>⌘K ile aç/kapa</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="text-[10px] font-bold uppercase text-muted px-3 py-1.5">{title}</p>
      <div>{children}</div>
    </div>
  );
}

function Row({ icon, title, subtitle, badge, onClick }: any) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-[#faf8f4]">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f0ede8' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-navy truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
      </div>
      {badge && <span className="text-[10px] font-semibold px-2 py-0.5 rounded flex-shrink-0"
        style={{ background: '#f0ede8', color: '#6b7280' }}>{badge}</span>}
    </button>
  );
}
