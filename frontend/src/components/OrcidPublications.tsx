'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Publication {
  title: string;
  year: string;
  type: string;
  typeLabel: string;
  journal: string;
  doi: string;
}
interface Affiliation {
  organization: string;
  role: string;
  department: string;
  startYear: string;
  endYear: string;
  current?: boolean;
}

export function OrcidPublications({ orcidId }: { orcidId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'works' | 'employments' | 'educations'>('works');

  useEffect(() => {
    api.get(`/ai/orcid/${orcidId}`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orcidId]);

  if (loading) return (
    <div className="card p-4 flex items-center gap-3">
      <div className="spinner" />
      <span className="text-sm text-muted">ORCID verisi yükleniyor...</span>
    </div>
  );

  if (!data || data.error || (!data.works?.length && !data.employments?.length && !data.educations?.length)) return null;

  return (
    <div>
      <h3 className="font-display font-semibold text-navy mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: '#a6ce39' }} />
        <span className="w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ background: '#a6ce39' }}>iD</span>
        ORCID Akademik Profil
        <a href={`https://orcid.org/${orcidId}`} target="_blank" rel="noopener noreferrer"
          className="text-xs font-normal text-muted hover:text-navy ml-1 font-mono">
          {orcidId} ↗
        </a>
      </h3>

      {/* İstatistikler */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Yayın', value: data.works?.length || 0, color: '#1a3a6b' },
          { label: 'Görev', value: data.employments?.length || 0, color: '#059669' },
          { label: 'Eğitim', value: data.educations?.length || 0, color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} className="card py-3 text-center">
            <p className="font-display text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Sekmeler */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: '#f0ede8' }}>
        {[
          { key: 'works', label: `Yayınlar (${data.works?.length || 0})` },
          { key: 'employments', label: `Görevler (${data.employments?.length || 0})` },
          { key: 'educations', label: `Eğitim (${data.educations?.length || 0})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex-1 text-xs py-1.5 px-2 rounded-lg font-medium transition-all ${tab === t.key ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Yayınlar */}
      {tab === 'works' && (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {(data.works || []).map((w: Publication, i: number) => (
            <div key={i} className="p-3 rounded-xl border hover:shadow-sm transition-shadow" style={{ borderColor: '#e8e4dc', background: 'white' }}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-navy leading-tight flex-1">{w.title}</p>
                {w.year && <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-semibold" style={{ background: '#f0ede8', color: '#6b7280' }}>{w.year}</span>}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {w.journal && <span className="text-xs text-muted italic">{w.journal}</span>}
                {w.typeLabel && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{w.typeLabel}</span>}
                {w.doi && (
                  <a href={`https://doi.org/${w.doi}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline">DOI ↗</a>
                )}
              </div>
            </div>
          ))}
          {!data.works?.length && <p className="text-xs text-muted text-center py-6">Yayın bulunamadı</p>}
        </div>
      )}

      {/* Görevler */}
      {tab === 'employments' && (
        <div className="space-y-2">
          {(data.employments || []).map((e: Affiliation, i: number) => (
            <div key={i} className="p-3 rounded-xl border" style={{ borderColor: '#e8e4dc', background: 'white' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">{e.organization}</p>
                  {e.role && <p className="text-xs text-muted">{e.role}</p>}
                  {e.department && <p className="text-xs text-muted">{e.department}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs text-muted">{e.startYear}{e.endYear ? ` – ${e.endYear}` : ''}</span>
                  {e.current && <p className="text-xs font-semibold" style={{ color: '#059669' }}>● Mevcut</p>}
                </div>
              </div>
            </div>
          ))}
          {!data.employments?.length && <p className="text-xs text-muted text-center py-6">Görev bulunamadı</p>}
        </div>
      )}

      {/* Eğitim */}
      {tab === 'educations' && (
        <div className="space-y-2">
          {(data.educations || []).map((e: Affiliation, i: number) => (
            <div key={i} className="p-3 rounded-xl border" style={{ borderColor: '#e8e4dc', background: 'white' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">{e.organization}</p>
                  {e.role && <p className="text-xs text-muted">{e.role}</p>}
                  {e.department && <p className="text-xs text-muted">{e.department}</p>}
                </div>
                <span className="text-xs text-muted flex-shrink-0">{e.startYear}{e.endYear ? ` – ${e.endYear}` : ''}</span>
              </div>
            </div>
          ))}
          {!data.educations?.length && <p className="text-xs text-muted text-center py-6">Eğitim bulunamadı</p>}
        </div>
      )}
    </div>
  );
}
