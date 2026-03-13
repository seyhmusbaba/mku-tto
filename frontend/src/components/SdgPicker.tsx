'use client';
import { SDG_GOALS } from '@/lib/utils';

interface Props {
  selected: string[];
  onChange: (v: string[]) => void;
}

export function SdgPicker({ selected, onChange }: Props) {
  const toggle = (code: string) => {
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SDG_GOALS.map(g => {
          const active = selected.includes(g.code);
          return (
            <button
              key={g.code}
              type="button"
              onClick={() => toggle(g.code)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all text-xs font-semibold"
              style={{
                background: active ? g.color : '#faf8f4',
                color: active ? 'white' : '#374151',
                border: `2px solid ${active ? g.color : '#e8e4dc'}`,
                boxShadow: active ? `0 2px 8px ${g.color}44` : 'none',
              }}
            >
              <span className="text-base leading-none flex-shrink-0">{g.emoji}</span>
              <span className="leading-tight">
                <span style={{ opacity: active ? 0.8 : 0.5, fontSize: 9, display: 'block', fontWeight: 700 }}>{g.code}</span>
                {g.label}
              </span>
              {active && <span className="ml-auto flex-shrink-0 w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-xs">✓</span>}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {selected.map(code => {
            const g = SDG_GOALS.find(x => x.code === code);
            if (!g) return null;
            return (
              <span key={code} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold text-white"
                style={{ background: g.color }}>
                {g.emoji} {g.code}
                <button type="button" onClick={() => toggle(code)} className="ml-1 opacity-70 hover:opacity-100">×</button>
              </span>
            );
          })}
          <button type="button" onClick={() => onChange([])} className="text-xs text-muted hover:text-red-500 px-2 py-1">Temizle</button>
        </div>
      )}
    </div>
  );
}
