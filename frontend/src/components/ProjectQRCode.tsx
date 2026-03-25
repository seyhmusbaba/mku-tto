'use client';
import { useState } from 'react';

interface Props {
  projectId: string;
  projectTitle: string;
}

export function ProjectQRCode({ projectId, projectTitle }: Props) {
  const [open, setOpen] = useState(false);
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');
  const qrUrl = `${base}/api/projects/${projectId}/qr`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5a.5.5 0 11-1 0 .5.5 0 011 0zM4 8h4V4H4v4zm0 8h4v-4H4v4zm12-8h4V4h-4v4z" />
        </svg>
        QR
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center max-w-xs w-full"
            style={{ border: '1px solid #e8e4dc' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-navy mb-1 text-sm">QR Kod</h3>
            <p className="text-xs text-muted mb-4 line-clamp-2">{projectTitle}</p>
            <div className="rounded-xl overflow-hidden border mb-3" style={{ borderColor: '#e8e4dc' }}>
              <img src={qrUrl} alt="QR Kod" className="w-full" />
            </div>
            <p className="text-xs text-muted mb-4">QR kodu okutarak projeye doğrudan erişilebilir</p>
            <div className="flex gap-2">
              <a href={qrUrl} download={`proje-${projectId}-qr.png`}
                className="btn-primary text-xs flex-1">⬇ İndir</a>
              <button onClick={() => setOpen(false)} className="btn-secondary text-xs flex-1">Kapat</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
