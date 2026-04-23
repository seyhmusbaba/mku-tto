'use client';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/lib/auth-context';
import { trainingApi } from '@/lib/api';

interface Program {
  id: string; title: string; description?: string; type: string;
  instructor?: string; startDate: string; endDate?: string;
  location?: string; onlineUrl?: string; maxParticipants: number;
  category?: string; status: string; registeredCount?: number;
  prerequisites?: string; materialsUrl?: string;
}

const TYPE_LABELS: Record<string, string> = {
  workshop: 'Atölye', seminar: 'Seminer', course: 'Kurs',
  webinar: 'Webinar', certification: 'Sertifika',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  upcoming: { bg: '#dbeafe', text: '#1e40af', label: 'Yaklaşan' },
  ongoing:  { bg: '#dcfce7', text: '#15803d', label: 'Devam Ediyor' },
  completed:{ bg: '#e5e7eb', text: '#374151', label: 'Tamamlandı' },
  cancelled:{ bg: '#fee2e2', text: '#b91c1c', label: 'İptal Edildi' },
};

export default function TrainingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role?.name === 'Süper Admin';
  const [programs, setPrograms] = useState<Program[]>([]);
  const [myRegs, setMyRegs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Program>>({
    title: '', description: '', type: 'workshop', instructor: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '', location: '', onlineUrl: '', maxParticipants: 30,
    category: '', status: 'upcoming',
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      trainingApi.listPrograms(filter === 'all' ? {} : filter === 'upcoming' ? { upcoming: 'true' } : { status: filter }),
      trainingApi.myRegs(),
    ])
      .then(([p, r]) => {
        setPrograms(p.data || []);
        setMyRegs(r.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (user) load(); }, [user, filter]);

  const myProgramIds = new Set(myRegs.map(r => r.programId));

  const register = async (id: string) => {
    try {
      await trainingApi.register(id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Kayıt başarısız');
    }
  };

  const unregister = async (id: string) => {
    if (!confirm('Kaydı iptal etmek istediğinize emin misiniz?')) return;
    await trainingApi.unregister(id);
    load();
  };

  const submitProgram = async () => {
    if (!form.title?.trim() || !form.startDate) return alert('Başlık ve başlangıç tarihi zorunlu');
    try {
      await trainingApi.createProgram(form);
      setShowForm(false);
      setForm({
        title: '', description: '', type: 'workshop', instructor: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '', location: '', onlineUrl: '', maxParticipants: 30,
        category: '', status: 'upcoming',
      });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Hata');
    }
  };

  return (
    <DashboardLayout>
      <Header title="Eğitim & Kapasite Geliştirme"
        subtitle={`${programs.length} program · ${myRegs.length} aktif kaydım`}
        actions={isAdmin && (
          <button className="btn-primary text-sm" onClick={() => setShowForm(s => !s)}>
            + Program Aç
          </button>
        )} />

      <div className="p-6 space-y-5">
        {/* Filtreler */}
        <div className="flex flex-wrap gap-2">
          {[
            { v: 'upcoming', l: 'Yaklaşan' },
            { v: 'ongoing', l: 'Devam Eden' },
            { v: 'completed', l: 'Tamamlanan' },
            { v: 'all', l: 'Hepsi' },
          ].map(o => (
            <button key={o.v}
              onClick={() => setFilter(o.v)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={{
                background: filter === o.v ? '#0f2444' : '#f0ede8',
                color: filter === o.v ? 'white' : '#6b7280',
              }}>
              {o.l}
            </button>
          ))}
        </div>

        {showForm && isAdmin && (
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-navy">Yeni Program</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="input md:col-span-2" placeholder="Başlık *"
                value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
              <textarea className="input md:col-span-2" placeholder="Açıklama" rows={2}
                value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
              <select className="input" value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input className="input" placeholder="Eğitmen"
                value={form.instructor || ''} onChange={e => setForm({ ...form, instructor: e.target.value })} />
              <input className="input" type="date" placeholder="Başlangıç *"
                value={form.startDate || ''} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              <input className="input" type="date" placeholder="Bitiş"
                value={form.endDate || ''} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              <input className="input" placeholder="Konum (örn: MKÜ Merkez - A-101)"
                value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} />
              <input className="input" placeholder="Online URL (Zoom/Teams)"
                value={form.onlineUrl || ''} onChange={e => setForm({ ...form, onlineUrl: e.target.value })} />
              <input className="input" type="number" placeholder="Max katılımcı"
                value={form.maxParticipants || 30} onChange={e => setForm({ ...form, maxParticipants: +e.target.value })} />
              <input className="input" placeholder="Kategori (IP, Proje yazma, Patent…)"
                value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary text-sm" onClick={submitProgram}>Kaydet</button>
              <button className="btn-secondary text-sm" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="card flex justify-center py-16"><div className="spinner" /></div>
        ) : programs.length === 0 ? (
          <div className="card py-16 text-center text-sm text-muted">Bu filtreye uygun program yok</div>
        ) : (
          <div className="grid gap-3">
            {programs.map(p => {
              const registered = myProgramIds.has(p.id);
              const full = (p.registeredCount || 0) >= p.maxParticipants;
              const status = STATUS_COLORS[p.status] || STATUS_COLORS.upcoming;
              return (
                <div key={p.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-navy">{p.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: status.bg, color: status.text }}>{status.label}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#f0ede8] text-[#0f2444] font-semibold">
                          {TYPE_LABELS[p.type] || p.type}
                        </span>
                        {p.category && <span className="text-xs text-muted">· {p.category}</span>}
                      </div>
                      {p.description && <p className="text-sm text-muted mt-1">{p.description}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted">
                        <span>📅 {p.startDate}{p.endDate ? ` → ${p.endDate}` : ''}</span>
                        {p.instructor && <span>👤 {p.instructor}</span>}
                        {p.location && <span>📍 {p.location}</span>}
                        {p.onlineUrl && <a className="text-blue-600 hover:underline" href={p.onlineUrl} target="_blank" rel="noreferrer">🔗 Online</a>}
                        <span>👥 {p.registeredCount || 0}/{p.maxParticipants}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {registered ? (
                        <button className="btn-secondary text-xs text-red-600" onClick={() => unregister(p.id)}>
                          Kaydı İptal Et
                        </button>
                      ) : p.status === 'upcoming' ? (
                        <button className="btn-primary text-xs" disabled={full} onClick={() => register(p.id)}>
                          {full ? 'Kontenjan Dolu' : 'Kayıt Ol'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
