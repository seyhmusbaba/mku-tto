'use client';
import { useEffect, useState } from 'react';
import { settingsApi } from '@/lib/api';

export function Footer() {
  const [text, setText] = useState('© Hatay Mustafa Kemal Üniversitesi TTO');

  useEffect(() => {
    settingsApi.getAll().then(r => {
      if (r.data?.footer_text) setText(r.data.footer_text);
    }).catch(() => {});
  }, []);

  return (
    <footer className="px-6 py-3 text-center text-xs text-muted border-t flex-shrink-0"
      style={{ borderColor: '#e8e4dc', background: 'white', minHeight: 36 }}>
      {text}
    </footer>
  );
}
