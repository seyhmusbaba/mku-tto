'use client';
import { useEffect, useState } from 'react';
import { scopusApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
  user: any;
  isMe: boolean;
}

export function ScopusProfileCard({ user, isMe }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [pubs, setPubs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showPubs, setShowPubs] = useState(false);
  const [pubsLoading, setPubsLoading] = useState(false);

  const authorId = user?.scopusAuthorId;

  useEffect(() => {
    if (!authorId) return;

    // DB'de kayıtlı metrikler varsa hemen göster
    if (user.scopusHIndex || user.scopusCitedBy || user.scopusDocCount) {
      setProfile({
        hIndex:        user.scopusHIndex || 0,
        citedByCount:  user.scopusCitedBy || 0,
        documentCount: user.scopusDocCount || 0,
        subjectAreas: (() => { try { return JSON.parse(user.scopusSubjects || '[]'); } catch { return []; } })(),
        lastSync:      user.scopusLastSync,
      });
      setLoading(false);
    } else {
      // DB'de veri yok — sync endpoint'ini çağır (önbelleksiz, taze veri)
      scopusApi.syncMyProfile()
        .then(r => {
          if (r.data?.success && r.data?.profile) {
            setProfile(r.data.profile);
          } else if (r.data?.error) {
            console.warn('Scopus sync hatası:', r.data.error);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [authorId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await scopusApi.syncMyProfile();
      if (r.data?.success) {
        setProfile(r.data.profile);
        toast.success('Scopus profili güncellendi');
      } else {
        toast.error(r.data?.error || 'Güncelleme başarısız');
      }
    } catch {
      toast.error('Scopus bağlantısı kurulamadı');
    } finally {
      setSyncing(false);
    }
  };

  const loadPublications = async () => {
    if (pubs.length) { setShowPubs(v => !v); return; }
    setShowPubs(true);
    setPubsLoading(true);
    try {
      const r = await scopusApi.getAuthorPublications(authorId, 15);
      setPubs(r.data || []);
    } catch { setPubs([]); }
    finally { setPubsLoading(false); }
  };

  if (!authorId) return null;

  if (loading) return (
    <div className="card p-4 flex items-center gap-3">
      <div className="spinner" />
      <span className="text-sm text-muted">Scopus verisi yükleniyor...</span>
    </div>
  );

  if (!profile) return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🔬</span>
        <span className="font-display font-semibold text-navy text-sm">Scopus Profili</span>
        <span className="text-xs text-muted font-mono ml-1">#{authorId}</span>
      </div>
      <p className="text-xs text-muted">
        Scopus verisi alınamadı. Institutional token gerekli olabilir veya Author ID hatalı.
      </p>
    </div>
  );

  return (
    <div>
      <h3 className="font-display font-semibold text-navy mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#e07a2b' }} />
        <span className="w-5 h-5 rounded text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0"
          style={{ background: '#e07a2b' }}>SC</span>
        Scopus Akademik Metrikleri
        <a href={`https://www.scopus.com/authid/detail.uri?authorId=${authorId}`}
          target="_blank" rel="noopener noreferrer"
          className="text-xs font-normal text-muted hover:text-navy ml-1 font-mono">
          #{authorId} ↗
        </a>
      </h3>

      <div className="card p-5 space-y-4">
        {/* Metrik kartları */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'h-index',    value: profile.hIndex,        color: '#7c3aed', icon: '📊' },
            { label: 'Atıf',       value: profile.citedByCount,  color: '#059669', icon: '🔗' },
            { label: 'Yayın',      value: profile.documentCount, color: '#1a3a6b', icon: '📄' },
          ].map(m => (
            <div key={m.label} className="text-center p-3 rounded-xl"
              style={{ background: m.color + '0d', border: `1px solid ${m.color}22` }}>
              <p className="text-2xl font-display font-bold" style={{ color: m.color }}>
                {m.value?.toLocaleString('tr-TR') ?? '—'}
              </p>
              <p className="text-xs text-muted mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Konu alanları */}
        {profile.subjectAreas?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile.subjectAreas.map((a: string) => (
              <span key={a} className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff' }}>
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Alt bar */}
        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: '#f0ede8' }}>
          <div className="flex items-center gap-3">
            <button onClick={loadPublications}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
              {showPubs ? '▲ Yayınları Gizle' : `📚 Yayınları Gör`}
            </button>
            {profile.lastSync && (
              <span className="text-xs text-muted">
                Son güncelleme: {new Date(profile.lastSync).toLocaleDateString('tr-TR')}
              </span>
            )}
          </div>
          {isMe && (
            <button onClick={handleSync} disabled={syncing}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
              style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
              {syncing ? <><span className="spinner w-3 h-3" />Güncelleniyor...</> : '🔄 Güncelle'}
            </button>
          )}
        </div>

        {/* Yayın listesi */}
        {showPubs && (
          <div className="mt-2 space-y-2">
            {pubsLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted">
                <span className="spinner w-4 h-4" /> Yayınlar yükleniyor...
              </div>
            ) : pubs.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">Yayın bulunamadı.</p>
            ) : (
              pubs.map((p, i) => (
                <div key={p.scopusId || i} className="p-3 rounded-xl text-xs space-y-1"
                  style={{ background: '#faf8f4', border: '1px solid #e8e4dc' }}>
                  <p className="font-semibold text-navy leading-snug">{p.title}</p>
                  <div className="flex items-center gap-3 text-muted flex-wrap">
                    {p.journal && <span>📖 {p.journal}</span>}
                    {p.year && <span>📅 {p.year}</span>}
                    {p.citedBy > 0 && (
                      <span className="font-semibold" style={{ color: '#059669' }}>
                        🔗 {p.citedBy} atıf
                      </span>
                    )}
                    {p.doi && (
                      <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer"
                        className="font-medium hover:underline" style={{ color: '#1a3a6b' }}>
                        DOI ↗
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
