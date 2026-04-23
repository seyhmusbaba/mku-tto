'use client';
import { useEffect, useState } from 'react';
import { lifecycleApi } from '@/lib/api';

interface Milestone {
  id: string; title: string; description?: string;
  dueDate?: string; completedAt?: string;
  status: string; orderIndex?: number;
}
interface Deliverable {
  id: string; title: string; type: string;
  dueDate?: string; deliveredAt?: string; status: string;
  fileUrl?: string;
}
interface Risk {
  id: string; title: string; probability: string;
  impact: string; mitigation?: string; status: string;
}

const MS_STATUS: Record<string, { label: string; color: string }> = {
  pending:      { label: 'Beklemede',    color: '#6b7280' },
  in_progress:  { label: 'Devam Ediyor', color: '#1a3a6b' },
  completed:    { label: 'Tamamlandı',   color: '#059669' },
  delayed:      { label: 'Gecikmiş',     color: '#dc2626' },
  cancelled:    { label: 'İptal',        color: '#6b7280' },
};

const DEL_TYPE: Record<string, string> = {
  report: 'Rapor', publication: 'Yayın', prototype: 'Prototip',
  dataset: 'Veri seti', software: 'Yazılım', presentation: 'Sunum',
  patent: 'Patent', other: 'Diğer',
};

const LEVEL: Record<string, { l: string; c: string }> = {
  low:    { l: 'Düşük',  c: '#059669' },
  medium: { l: 'Orta',   c: '#d97706' },
  high:   { l: 'Yüksek', c: '#dc2626' },
};

interface Props { projectId: string; readonly?: boolean }

export function ProjectLifecyclePanel({ projectId, readonly }: Props) {
  const [tab, setTab] = useState<'overview' | 'milestones' | 'deliverables' | 'risks'>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);

  const [msForm, setMsForm] = useState<Partial<Milestone>>({ status: 'pending' });
  const [delForm, setDelForm] = useState<Partial<Deliverable>>({ type: 'report', status: 'pending' });
  const [riskForm, setRiskForm] = useState<Partial<Risk>>({ probability: 'medium', impact: 'medium', status: 'open' });

  const [msAdd, setMsAdd] = useState(false);
  const [delAdd, setDelAdd] = useState(false);
  const [riskAdd, setRiskAdd] = useState(false);

  const load = () => {
    Promise.all([
      lifecycleApi.summary(projectId).catch(() => ({ data: null })),
      lifecycleApi.listMilestones(projectId).catch(() => ({ data: [] })),
      lifecycleApi.listDel(projectId).catch(() => ({ data: [] })),
      lifecycleApi.listRisks(projectId).catch(() => ({ data: [] })),
    ]).then(([s, m, d, r]) => {
      setSummary(s.data);
      setMilestones(m.data || []);
      setDeliverables(d.data || []);
      setRisks(r.data || []);
    });
  };

  useEffect(() => { load(); }, [projectId]);

  const saveMs = async () => {
    if (!msForm.title?.trim()) return;
    await lifecycleApi.createMs(projectId, msForm);
    setMsForm({ status: 'pending' }); setMsAdd(false); load();
  };
  const updMs = async (id: string, patch: Partial<Milestone>) => {
    await lifecycleApi.updateMs(projectId, id, patch); load();
  };
  const delMs = async (id: string) => {
    if (!confirm('Silinsin mi?')) return;
    await lifecycleApi.deleteMs(projectId, id); load();
  };

  const saveDel = async () => {
    if (!delForm.title?.trim()) return;
    await lifecycleApi.createDel(projectId, delForm);
    setDelForm({ type: 'report', status: 'pending' }); setDelAdd(false); load();
  };
  const updDel = async (id: string, patch: Partial<Deliverable>) => {
    await lifecycleApi.updateDel(projectId, id, patch); load();
  };
  const removeDel = async (id: string) => {
    if (!confirm('Silinsin mi?')) return;
    await lifecycleApi.deleteDel(projectId, id); load();
  };

  const saveRisk = async () => {
    if (!riskForm.title?.trim()) return;
    await lifecycleApi.createRisk(projectId, riskForm);
    setRiskForm({ probability: 'medium', impact: 'medium', status: 'open' }); setRiskAdd(false); load();
  };
  const updRisk = async (id: string, patch: Partial<Risk>) => {
    await lifecycleApi.updateRisk(projectId, id, patch); load();
  };
  const removeRisk = async (id: string) => {
    if (!confirm('Silinsin mi?')) return;
    await lifecycleApi.deleteRisk(projectId, id); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b" style={{ borderColor: '#f5f2ee' }}>
        {[
          { v: 'overview', l: 'Özet' },
          { v: 'milestones', l: `Kilometre Taşları (${milestones.length})` },
          { v: 'deliverables', l: `Teslimatlar (${deliverables.length})` },
          { v: 'risks', l: `Riskler (${risks.length})` },
        ].map((t: any) => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t.v ? 'text-[#0f2444] border-[#c8a45a]' : 'text-muted border-transparent hover:text-[#0f2444]'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'overview' && summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="card p-4">
            <h4 className="text-xs font-bold uppercase text-muted mb-2">Kilometre Taşları</h4>
            <p className="text-2xl font-bold text-navy">{summary.milestones?.total || 0}</p>
            <div className="text-xs text-muted mt-1 space-y-0.5">
              <div>✓ {summary.milestones?.completed || 0} tamamlanan</div>
              <div>● {summary.milestones?.inProgress || 0} devam eden</div>
              <div className="text-red-600">⚠ {summary.milestones?.delayed || 0} gecikmiş</div>
            </div>
          </div>
          <div className="card p-4">
            <h4 className="text-xs font-bold uppercase text-muted mb-2">Teslimatlar</h4>
            <p className="text-2xl font-bold text-navy">{summary.deliverables?.total || 0}</p>
            <div className="text-xs text-muted mt-1 space-y-0.5">
              <div>✓ {summary.deliverables?.accepted || 0} kabul</div>
              <div>↑ {summary.deliverables?.submitted || 0} teslim edildi</div>
              <div>○ {summary.deliverables?.pending || 0} beklemede</div>
            </div>
          </div>
          <div className="card p-4">
            <h4 className="text-xs font-bold uppercase text-muted mb-2">Riskler</h4>
            <p className="text-2xl font-bold text-navy">{summary.risks?.total || 0}</p>
            <div className="text-xs text-muted mt-1 space-y-0.5">
              <div>○ {summary.risks?.open || 0} açık</div>
              <div className="text-red-600">🔥 {summary.risks?.high || 0} yüksek etki</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'milestones' && (
        <div className="space-y-2">
          {!readonly && (
            msAdd ? (
              <div className="card p-3 space-y-2">
                <input className="input" placeholder="Başlık"
                  value={msForm.title || ''} onChange={e => setMsForm({ ...msForm, title: e.target.value })} />
                <div className="flex gap-2">
                  <input className="input flex-1" type="date" placeholder="Son tarih"
                    value={msForm.dueDate || ''} onChange={e => setMsForm({ ...msForm, dueDate: e.target.value })} />
                  <select className="input flex-1" value={msForm.status}
                    onChange={e => setMsForm({ ...msForm, status: e.target.value })}>
                    {Object.entries(MS_STATUS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary text-xs" onClick={saveMs}>Kaydet</button>
                  <button className="btn-secondary text-xs" onClick={() => setMsAdd(false)}>İptal</button>
                </div>
              </div>
            ) : (
              <button className="btn-secondary text-xs" onClick={() => setMsAdd(true)}>+ Yeni Kilometre Taşı</button>
            )
          )}
          {milestones.length === 0 && !msAdd && <p className="text-xs text-muted">Kilometre taşı yok</p>}
          {milestones.map(m => {
            const s = MS_STATUS[m.status] || MS_STATUS.pending;
            return (
              <div key={m.id} className="card p-3 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: s.color }} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{m.title}</p>
                  <div className="flex gap-3 text-xs text-muted mt-0.5">
                    {m.dueDate && <span>📅 {m.dueDate}</span>}
                    {m.completedAt && <span className="text-green-700">✓ {m.completedAt}</span>}
                  </div>
                </div>
                {!readonly && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <select className="input text-xs py-1" value={m.status}
                      onChange={e => updMs(m.id, { status: e.target.value })}>
                      {Object.entries(MS_STATUS).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}
                    </select>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => delMs(m.id)}>Sil</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'deliverables' && (
        <div className="space-y-2">
          {!readonly && (
            delAdd ? (
              <div className="card p-3 space-y-2">
                <input className="input" placeholder="Teslimat başlığı"
                  value={delForm.title || ''} onChange={e => setDelForm({ ...delForm, title: e.target.value })} />
                <div className="flex gap-2">
                  <select className="input flex-1" value={delForm.type}
                    onChange={e => setDelForm({ ...delForm, type: e.target.value })}>
                    {Object.entries(DEL_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input className="input flex-1" type="date"
                    value={delForm.dueDate || ''} onChange={e => setDelForm({ ...delForm, dueDate: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary text-xs" onClick={saveDel}>Kaydet</button>
                  <button className="btn-secondary text-xs" onClick={() => setDelAdd(false)}>İptal</button>
                </div>
              </div>
            ) : (
              <button className="btn-secondary text-xs" onClick={() => setDelAdd(true)}>+ Yeni Teslimat</button>
            )
          )}
          {deliverables.length === 0 && !delAdd && <p className="text-xs text-muted">Teslimat yok</p>}
          {deliverables.map(d => (
            <div key={d.id} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{d.title}</p>
                <div className="flex gap-3 text-xs text-muted mt-0.5">
                  <span>{DEL_TYPE[d.type] || d.type}</span>
                  {d.dueDate && <span>📅 {d.dueDate}</span>}
                  {d.deliveredAt && <span className="text-green-700">✓ {d.deliveredAt}</span>}
                  {d.fileUrl && <a className="text-blue-600 hover:underline" href={d.fileUrl} target="_blank" rel="noreferrer">Dosya</a>}
                </div>
              </div>
              {!readonly && (
                <div className="flex gap-1.5 flex-shrink-0">
                  <select className="input text-xs py-1" value={d.status}
                    onChange={e => updDel(d.id, { status: e.target.value })}>
                    <option value="pending">Beklemede</option>
                    <option value="in_progress">Üzerinde çalışılıyor</option>
                    <option value="submitted">Teslim edildi</option>
                    <option value="accepted">Kabul edildi</option>
                    <option value="rejected">Reddedildi</option>
                  </select>
                  <button className="text-xs text-red-600 hover:underline" onClick={() => removeDel(d.id)}>Sil</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'risks' && (
        <div className="space-y-2">
          {!readonly && (
            riskAdd ? (
              <div className="card p-3 space-y-2">
                <input className="input" placeholder="Risk başlığı"
                  value={riskForm.title || ''} onChange={e => setRiskForm({ ...riskForm, title: e.target.value })} />
                <div className="flex gap-2">
                  <select className="input flex-1" value={riskForm.probability}
                    onChange={e => setRiskForm({ ...riskForm, probability: e.target.value })}>
                    <option value="low">Olasılık: Düşük</option>
                    <option value="medium">Olasılık: Orta</option>
                    <option value="high">Olasılık: Yüksek</option>
                  </select>
                  <select className="input flex-1" value={riskForm.impact}
                    onChange={e => setRiskForm({ ...riskForm, impact: e.target.value })}>
                    <option value="low">Etki: Düşük</option>
                    <option value="medium">Etki: Orta</option>
                    <option value="high">Etki: Yüksek</option>
                  </select>
                </div>
                <textarea className="input" rows={2} placeholder="Azaltım stratejisi"
                  value={riskForm.mitigation || ''} onChange={e => setRiskForm({ ...riskForm, mitigation: e.target.value })} />
                <div className="flex gap-2">
                  <button className="btn-primary text-xs" onClick={saveRisk}>Kaydet</button>
                  <button className="btn-secondary text-xs" onClick={() => setRiskAdd(false)}>İptal</button>
                </div>
              </div>
            ) : (
              <button className="btn-secondary text-xs" onClick={() => setRiskAdd(true)}>+ Yeni Risk</button>
            )
          )}
          {risks.length === 0 && !riskAdd && <p className="text-xs text-muted">Risk kaydı yok</p>}
          {risks.map(r => {
            const p = LEVEL[r.probability] || LEVEL.medium;
            const i = LEVEL[r.impact] || LEVEL.medium;
            return (
              <div key={r.id} className="card p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{r.title}</p>
                    <div className="flex gap-3 text-xs mt-1">
                      <span className="font-semibold" style={{ color: p.c }}>Olasılık: {p.l}</span>
                      <span className="font-semibold" style={{ color: i.c }}>Etki: {i.l}</span>
                      <span className={r.status === 'closed' ? 'text-green-700' : r.status === 'mitigating' ? 'text-amber-700' : 'text-red-700'}>
                        {r.status === 'open' ? 'Açık' : r.status === 'mitigating' ? 'Azaltılıyor' : 'Kapalı'}
                      </span>
                    </div>
                    {r.mitigation && <p className="text-xs text-muted mt-1">💡 {r.mitigation}</p>}
                  </div>
                  {!readonly && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <select className="input text-xs py-1" value={r.status}
                        onChange={e => updRisk(r.id, { status: e.target.value })}>
                        <option value="open">Açık</option>
                        <option value="mitigating">Azaltılıyor</option>
                        <option value="closed">Kapalı</option>
                      </select>
                      <button className="text-xs text-red-600 hover:underline" onClick={() => removeRisk(r.id)}>Sil</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
