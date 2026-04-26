'use client';
import { useEffect, useState } from 'react';
import { scopusApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  canEdit: boolean;
  projectTitle: string;
}

export function ScopusPublications({ projectId, canEdit, projectTitle }: Props) {
  const [related, setRelated]         = useState<any[]>([]);
  const [linked, setLinked]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [linking, setLinking]         = useState<string | null>(null);
  const [unlinking, setUnlinking]     = useState<string | null>(null);
  const [authorCount, setAuthorCount] = useState(0);
  const [tab, setTab]                 = useState<'related' | 'linked'>('linked');
  const [scopusOff, setScopusOff]     = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [relRes, lnkRes] = await Promise.all([
          scopusApi.getRelatedPublications(projectId),
          scopusApi.getLinkedPublications(projectId),
        ]);
        if (relRes.data?.error) { setScopusOff(true); return; }
        setRelated(relRes.data?.publications || []);
        setAuthorCount(relRes.data?.authorCount || 0);
        setLinked(lnkRes.data || []);
        if ((lnkRes.data || []).length === 0) setTab('related');
      } catch { setScopusOff(true); }
      finally { setLoading(false); }
    };
    load();
  }, [projectId]);

  const handleLink = async (pub: any) => {
    setLinking(pub.scopusId);
    try {
      const r = await scopusApi.linkPublication(projectId, pub);
      if (r.data?.success) {
        setLinked(r.data.linked);
        toast.success('Yayın projeye bağlandı');
      } else {
        toast.error(r.data?.error || 'Bağlanamadı');
      }
    } catch { toast.error('Hata oluştu'); }
    finally { setLinking(null); }
  };

  const handleUnlink = async (scopusId: string) => {
    setUnlinking(scopusId);
    try {
      const r = await scopusApi.unlinkPublication(projectId, scopusId);
      if (r.data?.success) { setLinked(r.data.linked); toast.success('Bağlantı kaldırıldı'); }
    } catch { toast.error('Hata oluştu'); }
    finally { setUnlinking(null); }
  };

  if (scopusOff) return null;

  if (loading) return (
    <div className="card p-4 flex items-center gap-3">
      <div className="spinner" />
      <span className="text-sm text-muted">Scopus yayınları yükleniyor...</span>
    </div>
  );

  const linkedIds = new Set(linked.map((p: any) => p.scopusId));

  return (
    <div className="card p-5">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-semibold text-navy flex items-center gap-2">
          <span className="w-5 h-5 rounded text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0"
            style={{ background: '#e07a2b' }}>SC</span>
          Scopus Yayınları
          {linked.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #86efac' }}>
              {linked.length} bağlı
            </span>
          )}
        </h3>
        <div className="flex gap-1">
          {(['linked', 'related'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{
                background: tab === t ? '#0f2444' : '#f0ede8',
                color:      tab === t ? 'white'   : '#6b7280',
              }}>
              {t === 'linked' ? `Bağlı (${linked.length})` : `Öneriler (${related.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Bağlı yayınlar */}
      {tab === 'linked' && (
        <>
          {linked.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-2xl mb-2">📚</p>
              <p className="text-sm font-medium text-navy">Henüz yayın bağlanmamış</p>
              <p className="text-xs text-muted mt-1">
                "Öneriler" sekmesinden bu projeyle ilgili Scopus yayınlarını bağlayabilirsiniz
              </p>
              <button onClick={() => setTab('related')} className="btn-ghost text-xs mt-3">
                Önerilere Git →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {linked.map((p: any) => (
                <PublicationRow key={p.scopusId} pub={p}
                  action={canEdit ? { label: '✕ Kaldır', loading: unlinking === p.scopusId, onClick: () => handleUnlink(p.scopusId), danger: true } : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Önerilen yayınlar */}
      {tab === 'related' && (
        <>
          {authorCount === 0 && (
            <div className="p-3 rounded-xl mb-3 text-xs"
              style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
              ⚠️ Proje ekibinde Scopus Author ID tanımlı üye yok. Sonuçlar anahtar kelime bazlı.
            </div>
          )}
          {related.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted">Scopus'ta ilgili yayın bulunamadı.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {related.map((p: any) => (
                <PublicationRow key={p.scopusId} pub={p}
                  linked={linkedIds.has(p.scopusId)}
                  action={canEdit && !linkedIds.has(p.scopusId)
                    ? { label: '+ Bağla', loading: linking === p.scopusId, onClick: () => handleLink(p), danger: false }
                    : linkedIds.has(p.scopusId) ? { label: '✓ Bağlı', loading: false, onClick: () => {}, danger: false, disabled: true } : undefined
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PublicationRow({ pub, action, linked }: {
  pub: any;
  action?: { label: string; loading: boolean; onClick: () => void; danger: boolean; disabled?: boolean };
  linked?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl"
      style={{ background: linked ? '#f0fdf4' : '#faf8f4', border: `1px solid ${linked ? '#86efac' : '#e8e4dc'}` }}>
      <div className="flex-1 min-w-0">
        {pub.title && pub.title.trim() ? (
          <p className="text-xs font-semibold text-navy leading-snug line-clamp-2">{pub.title}</p>
        ) : (
          <p className="text-xs font-semibold text-amber-700 leading-snug">
            ⚠ Yayın başlığı alınamadı
            {pub.scopusId && <span className="text-muted font-normal"> · Scopus ID: {pub.scopusId}</span>}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {pub.firstAuthor && <span className="text-xs text-muted">{pub.firstAuthor}</span>}
          {pub.journal && <span className="text-xs text-muted truncate max-w-[160px]">📖 {pub.journal}</span>}
          {pub.year && <span className="text-xs text-muted">📅 {pub.year}</span>}
          {pub.citedBy > 0 && (
            <span className="text-xs font-semibold" style={{ color: '#059669' }}>🔗 {pub.citedBy}</span>
          )}
          {pub.doi ? (
            <a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium hover:underline" style={{ color: '#1a3a6b' }}>
              DOI ↗
            </a>
          ) : pub.scopusId && (
            <a href={`https://www.scopus.com/record/display.uri?eid=2-s2.0-${pub.scopusId}&origin=resultslist`} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium hover:underline" style={{ color: '#e07a2b' }}>
              Scopus ↗
            </a>
          )}
        </div>
      </div>
      {action && (
        <button onClick={action.onClick} disabled={action.loading || action.disabled}
          className="text-xs px-2.5 py-1.5 rounded-lg font-semibold flex-shrink-0 transition-all disabled:opacity-50"
          style={{
            background: action.disabled ? '#f0fdf4' : action.danger ? '#fff0f0' : '#eff6ff',
            color:      action.disabled ? '#059669' : action.danger ? '#dc2626' : '#1a3a6b',
            border:     `1px solid ${action.disabled ? '#86efac' : action.danger ? '#fecaca' : '#bfdbfe'}`,
          }}>
          {action.loading ? <span className="spinner w-3 h-3" /> : action.label}
        </button>
      )}
    </div>
  );
}
