'use client';
import { useEffect, useRef, useState } from 'react';
import { assistantApi } from '@/lib/api';

interface Msg { role: 'user' | 'assistant'; content: string; error?: boolean }

/**
 * PORTA Asistan — sağ altta kayar bir buton. Tıklanınca sağdan
 * slide-in bir sohbet paneli açar. Her sayfada görünür, sayfa
 * içeriğini bozmadan chat yapılabilir.
 */
export function PortaAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState<'general' | 'project' | 'competitions' | 'publications'>('general');
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      // Panel açılınca aşağıya kaydır
      setTimeout(() => boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' }), 50);
    }
  }, [open, messages]);

  const send = async (text: string, ctx?: typeof context) => {
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
        content: e?.response?.data?.message || 'Yanıt alınamadı — asistan servisi şu an kullanılamıyor.',
        error: true,
      }]);
    } finally {
      setSending(false);
    }
  };

  const clear = () => setMessages([]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="PORTA Asistan"
        className="fixed z-40 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 overflow-hidden"
        style={{
          bottom: 24,
          right: 24,
          width: 64,
          height: 64,
          background: '#ffffff',
          boxShadow: '0 10px 30px rgba(15, 36, 68, 0.35), 0 4px 12px rgba(200, 164, 90, 0.3)',
          border: '2px solid rgba(200, 164, 90, 0.4)',
        }}
      >
        {open ? (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)' }}>
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        ) : (
          <div className="relative w-full h-full">
            <img src="/porta.png" alt="PORTA" className="w-full h-full object-cover" />
            {/* Aktif nokta */}
            <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
          </div>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px]"
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        />
      )}

      {/* Chat Panel */}
      {open && (
        <div
          className="fixed z-40 flex flex-col bg-white shadow-2xl"
          style={{
            bottom: 96,
            right: 24,
            width: 'min(420px, calc(100vw - 48px))',
            height: 'min(640px, calc(100vh - 140px))',
            borderRadius: 20,
            overflow: 'hidden',
            animation: 'slideUp 0.25s ease-out',
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-3.5 flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)' }}
          >
            <div
              className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden bg-white"
              style={{ border: '2px solid rgba(200, 164, 90, 0.6)' }}
            >
              <img src="/porta.png" alt="PORTA" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-none">PORTA Asistan</p>
              <p className="text-white/60 text-[10px] mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Çevrimiçi · gerçek veriyle
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clear}
                title="Sohbeti temizle"
                className="text-white/50 hover:text-white transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>

          {/* Context selector */}
          <div className="border-b px-4 py-2 flex items-center gap-2 bg-[#faf8f4]" style={{ borderColor: '#f0ede8' }}>
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Bağlam</span>
            <select
              value={context}
              onChange={e => setContext(e.target.value as any)}
              className="text-xs px-2 py-1 rounded-md border bg-white flex-1 focus:outline-none focus:ring-1"
              style={{ borderColor: '#e8e4dc' }}
            >
              <option value="general">Genel</option>
              <option value="project">Projeler</option>
              <option value="competitions">Yarışmalar</option>
              <option value="publications">Yayınlar</option>
            </select>
          </div>

          {/* Messages */}
          <div
            ref={boxRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            style={{ background: '#fefdfb' }}
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div
                  className="w-16 h-16 rounded-full overflow-hidden mb-3 bg-white"
                  style={{ border: '3px solid rgba(200, 164, 90, 0.4)' }}
                >
                  <img src="/porta.png" alt="PORTA" className="w-full h-full object-cover" />
                </div>
                <p className="text-sm font-semibold text-navy">Merhaba, ben PORTA</p>
                <p className="text-xs text-muted mt-1">Portaldaki gerçek veriyle sorularınızı yanıtlarım.</p>
                <div className="mt-5 space-y-1.5 w-full">
                  {[
                    { t: 'Aktif projelerimin durumu?', c: 'project' as const },
                    { t: 'Açık yarışma fırsatları neler?', c: 'competitions' as const },
                    { t: 'Yeni bir proje nasıl açarım?', c: 'general' as const },
                  ].map((p, i) => (
                    <button
                      key={i}
                      onClick={() => { setContext(p.c); send(p.t, p.c); }}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg bg-[#f0ede8] hover:bg-[#e8e2d6] transition-colors"
                    >
                      {p.t}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-[#0f2444] text-white rounded-br-sm'
                        : m.error
                        ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                        : 'bg-[#f0ede8] text-[#0f2444] rounded-bl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-[#f0ede8] rounded-2xl rounded-bl-sm px-4 py-2.5">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0f2444]/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0f2444]/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0f2444]/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3 flex gap-2 bg-white" style={{ borderColor: '#f0ede8' }}>
            <textarea
              className="flex-1 resize-none rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-[#c8a45a]/30 focus:border-[#c8a45a]"
              style={{ borderColor: '#e8e4dc', minHeight: 40, maxHeight: 100 }}
              rows={1}
              placeholder="Mesaj yaz..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              disabled={sending}
            />
            <button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #0f2444, #1a3a6b)' }}
              aria-label="Gönder"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.125A59.769 59.769 0 0121.485 12 59.768 59.768 0 013.27 20.875L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
