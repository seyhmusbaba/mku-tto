'use client';
import { useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Header } from '@/components/layout/Header';
import { assistantApi } from '@/lib/api';

interface Msg { role: 'user' | 'assistant'; content: string; error?: boolean; }

const QUICK_PROMPTS = [
  { c: 'project',      t: 'Bu ay sisteme eklenen projelerde öne çıkan alanlar neler?' },
  { c: 'project',      t: 'Aktif projelerimin durumunu özetle.' },
  { c: 'competitions', t: 'Şu an açık olan yarışma/destek fırsatları nelerdir?' },
  { c: 'general',      t: 'Yeni bir proje oluşturmak için hangi adımları izlemeliyim?' },
  { c: 'publications', t: 'Bir yayını kaydıma nasıl eklerim?' },
  { c: 'general',      t: 'Fikri mülkiyet (patent) başvurusu için sistem nasıl yardım eder?' },
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState<string>('general');
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string, ctx?: string) => {
    const q = text.trim();
    if (!q || sending) return;
    const newMsgs: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(newMsgs);
    setInput('');
    setSending(true);
    try {
      const res = await assistantApi.chat(
        newMsgs.map(m => ({ role: m.role, content: m.content })),
        ctx || context,
      );
      setMessages([...newMsgs, { role: 'assistant', content: res.data?.text || '(boş yanıt)' }]);
    } catch (e: any) {
      setMessages([...newMsgs, {
        role: 'assistant',
        content: e?.response?.data?.message || 'Yanıt alınamadı — ANTHROPIC_API_KEY tanımlı değilse asistan çalışmaz.',
        error: true,
      }]);
    } finally {
      setSending(false);
    }
  };

  const clear = () => setMessages([]);

  return (
    <DashboardLayout>
      <Header title="TTO Asistan"
        subtitle="TTO portalında biriken gerçek veriyi kullanan dijital yardımcı"
        actions={
          messages.length > 0 && (
            <button className="btn-secondary text-sm" onClick={clear}>Sohbeti Temizle</button>
          )
        } />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        {/* Sohbet */}
        <div className="card p-0 flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
          <div className="border-b px-4 py-2 flex items-center gap-2" style={{ borderColor: '#f5f2ee' }}>
            <span className="text-xs font-semibold text-muted">Bağlam:</span>
            <select className="input py-1 text-xs w-40"
              value={context} onChange={e => setContext(e.target.value)}>
              <option value="general">Genel</option>
              <option value="project">Projeler</option>
              <option value="competitions">Yarışmalar</option>
              <option value="publications">Yayınlar</option>
              <option value="training">Eğitim</option>
            </select>
            <span className="ml-auto text-[10px] text-muted">
              {messages.length} mesaj · {context}
            </span>
          </div>

          <div ref={boxRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#f0ede8] mb-3">
                  <svg className="w-6 h-6 text-[#0f2444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p>Merhaba! TTO portalındaki veriyle destekli asistanın.</p>
                <p className="text-xs mt-1 text-muted">Aşağıdaki hazır sorulardan birini seçebilirsin.</p>
              </div>
            ) : messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-[#0f2444] text-white' : m.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-[#f0ede8] text-[#0f2444]'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-[#f0ede8] text-[#0f2444] rounded-2xl px-4 py-2.5 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3 flex gap-2" style={{ borderColor: '#f5f2ee' }}>
            <textarea className="input flex-1 resize-none" rows={2}
              placeholder="Asistanla konuş..."
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault(); send(input);
                }
              }}
              disabled={sending} />
            <button className="btn-primary text-sm px-5" disabled={sending || !input.trim()}
              onClick={() => send(input)}>
              Gönder
            </button>
          </div>
        </div>

        {/* Öneriler */}
        <aside className="space-y-3">
          <div className="card p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Hazır Sorular</h3>
            <div className="space-y-1.5">
              {QUICK_PROMPTS.map((p, i) => (
                <button key={i}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-[#faf8f4] hover:bg-[#f0ede8] transition-colors"
                  onClick={() => { setContext(p.c); send(p.t, p.c); }}
                  disabled={sending}>
                  {p.t}
                </button>
              ))}
            </div>
          </div>
          <div className="card p-4 text-xs text-muted">
            <p className="font-semibold text-navy mb-1">Asistan neleri biliyor?</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Senin profil bilgilerin</li>
              <li>Sistemdeki proje sayıları ve son kayıtlar</li>
              <li>Açık yarışma/destek çağrıları</li>
              <li>Senin yayın listen</li>
            </ul>
            <p className="mt-2 text-[11px]">Dış bilgi uydurmaz — veri portalda yoksa "bilgi yok" der.</p>
          </div>
        </aside>
      </div>
    </DashboardLayout>
  );
}
