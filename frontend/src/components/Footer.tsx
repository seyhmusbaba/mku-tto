'use client';
import { useEffect, useState } from 'react';
import { loadSettings, getSettings, subscribeSettings } from '@/lib/settings-store';

export function Footer() {
  const [text, setText] = useState(() => getSettings().footer_text || '© Hatay Mustafa Kemal Üniversitesi TTO');

  useEffect(() => {
    const apply = (s: any) => { if (s.footer_text) setText(s.footer_text); };
    apply(getSettings());
    loadSettings().then(apply);
    return subscribeSettings(apply);
  }, []);

  return (
    <footer className="px-6 py-3 text-center text-xs text-muted border-t flex-shrink-0"
      style={{ borderColor: '#e8e4dc', background: 'white', minHeight: 36 }}>
      {text}
    </footer>
  );
}
