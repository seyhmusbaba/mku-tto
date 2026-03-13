'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { aiApi } from '@/lib/api';
import { Project } from '@/types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  excludeId?: string;
}

export function SimilarProjectsAlert({ title, description, excludeId }: Props) {
  const [similar, setSimilar] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (title.length < 5) { setSimilar([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await aiApi.getSimilar(title, description || '', excludeId);
        setSimilar(res.data || []);
        setOpen(true);
      } catch {}
      finally { setLoading(false); }
    }, 700);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [title, description, excludeId]);

  if (!loading && similar.length === 0) return null;
  if (!open) return null;

  return (
    <div className="rounded-2xl border p-4" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <span className="font-semibold text-sm" style={{ color: '#92400e' }}>
            {loading ? 'Benzer projeler aranıyor...' : `${similar.length} benzer proje bulundu`}
          </span>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-navy text-xs">✕ Kapat</button>
      </div>
      {!loading && similar.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted mb-2">Bu başvuruya benzer içerikte mevcut projeler var. Mükerrer kayıt önlemek için inceleyin:</p>
          {similar.map(p => (
            <Link key={p.id} href={`/projects/${p.id}`} target="_blank"
              className="flex items-center justify-between p-3 rounded-xl hover:bg-yellow-50 transition-colors group"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #fde68a' }}>
              <div>
                <p className="text-sm font-semibold text-navy group-hover:underline line-clamp-1">{p.title}</p>
                <p className="text-xs text-muted mt-0.5">{p.faculty || '—'} · {p.owner?.firstName} {p.owner?.lastName}</p>
              </div>
              <span className={`badge text-xs flex-shrink-0 ml-2 ${PROJECT_STATUS_COLORS[p.status]}`}>
                {PROJECT_STATUS_LABELS[p.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
