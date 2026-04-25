'use client';
import { useEffect, useRef, useState } from 'react';
import { assistantApi } from '@/lib/api';

interface Msg {
  role: 'user' | 'assistant';
  content: string;        // tam cevap
  visible?: string;       // typewriter için şu ana kadar gösterilen kısım
  typing?: boolean;       // hâlâ yazılıyor mu
  error?: boolean;
}

/**
 * Markdown sembollerini ve yorum satırı stilini temizler - düz sohbet için.
 */
function cleanText(s: string): string {
  return s
    .replace(/^\s*[•\-*]\s+/gm, '')      // bullet (• - *)
    .replace(/^\s*\d+\.\s+/gm, '')        // numaralı liste
    .replace(/^\s*#{1,6}\s+/gm, '')       // markdown başlık (#, ##, ...)
    .replace(/\*\*(.+?)\*\*/g, '$1')      // **bold**
    .replace(/__(.+?)__/g, '$1')          // __bold__
    .replace(/\*(.+?)\*/g, '$1')          // *italic*
    .replace(/_(.+?)_/g, '$1')            // _italic_
    .replace(/`([^`]+)`/g, '$1')          // `code`
    .replace(/```[\s\S]*?```/g, '')       // kod blokları
    .replace(/^\s*>\s?/gm, '')            // blockquote
    .replace(/\n{3,}/g, '\n\n')           // aşırı boş satır
    .trim();
}

/**
 * PORTA Asistan - her sayfada sağ altta görünen yay/kapanır sohbet paneli.
 * Yanıtlar typewriter (yazıyormuş gibi) efektle akar, açılış-kapanış animasyonlu.
 */
export function PortaAssistant() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);   // açılış animasyonu için
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState<'general' | 'project' | 'competitions' | 'publications'>('general');
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const typingTimers = useRef<number[]>([]);

  // Açılış/kapanış mount koordinasyonu - transition'a zaman tanı
  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      const t = window.setTimeout(() => setMounted(false), 280);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Her mesaj değişiminde aşağı kaydır
  useEffect(() => {
    if (!boxRef.current) return;
    boxRef.current.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Component unmount olduğunda timer'ları temizle
  useEffect(() => () => { typingTimers.current.forEach(clearTimeout); }, []);

  /**
   * Asistan yanıtını karakter karakter göster - hız: 12-18ms/karakter,
   * noktalama sonrası ek küçük duraklama.
   */
  const typewriter = (fullText: string) => {
    // Önceki yazma işlemlerini iptal et
    typingTimers.current.forEach(clearTimeout);
    typingTimers.current = [];

    let i = 0;
    const step = () => {
      if (i >= fullText.length) {
        setMessages(prev => prev.map((m, idx) =>
          idx === prev.length - 1 && m.role === 'assistant'
            ? { ...m, visible: fullText, typing: false }
            : m
        ));
        return;
      }
      i += 1;
      setMessages(prev => prev.map((m, idx) =>
        idx === prev.length - 1 && m.role === 'assistant'
          ? { ...m, visible: fullText.slice(0, i) }
          : m
      ));
      // Noktalama sonrası hafif gecikme - daha doğal görünüm
      const lastChar = fullText[i - 1];
      const delay = /[.!?]/.test(lastChar) ? 140 : /[,;:]/.test(lastChar) ? 70 : 14;
      const t = window.setTimeout(step, delay);
      typingTimers.current.push(t);
    };
    step();
  };

  const send = async (text: string, ctx?: typeof context) => {
    const q = text.trim();
    if (!q || sending) return;
    const newMsgs: Msg[] = [...messages, { role: 'user', content: q, visible: q }];
    setMessages(newMsgs);
    setInput('');
    setSending(true);
    try {
      const res = await assistantApi.chat(
        newMsgs.map(m => ({ role: m.role, content: m.content })),
        ctx || context,
      );
      const raw = res.data?.text || '(boş yanıt)';
      const clean = cleanText(raw);
      setMessages(prev => [...prev, { role: 'assistant', content: clean, visible: '', typing: true }]);
      setSending(false);
      // Bir sonraki tick'te typewriter başlat
      window.setTimeout(() => typewriter(clean), 50);
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Yanıt alınamadı - asistan servisi şu an kullanılamıyor.';
      setMessages(prev => [...prev, { role: 'assistant', content: msg, visible: msg, error: true }]);
      setSending(false);
    }
  };

  const clear = () => {
    typingTimers.current.forEach(clearTimeout);
    typingTimers.current = [];
    setMessages([]);
  };

  return (
    <>
      {/* ─────────── Floating Button ─────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="PORTA Asistan"
        className="fixed z-40 rounded-full flex items-center justify-center overflow-hidden porta-fab"
        style={{
          bottom: 24,
          right: 24,
          width: 64,
          height: 64,
          background: '#ffffff',
          boxShadow: '0 10px 30px rgba(15, 36, 68, 0.35), 0 4px 12px rgba(200, 164, 90, 0.3)',
          border: '2px solid rgba(200, 164, 90, 0.4)',
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: open ? 'rotate(90deg) scale(0.9)' : 'rotate(0deg) scale(1)',
        }}
      >
        {open ? (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)' }}>
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        ) : (
          <div className="relative w-full h-full">
            <img src="/porta.png" alt="PORTA" className="w-full h-full object-cover" />
            <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
            {/* nefes alma halkası */}
            <span className="porta-pulse" />
          </div>
        )}
      </button>

      {/* ─────────── Backdrop ─────────── */}
      {mounted && (
        <div
          onClick={() => setOpen(false)}
          className={`fixed inset-0 z-30 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ background: 'rgba(15, 36, 68, 0.18)', backdropFilter: 'blur(3px)' }}
        />
      )}

      {/* ─────────── Chat Panel ─────────── */}
      {mounted && (
        <div
          className={`fixed z-40 flex flex-col bg-white overflow-hidden porta-panel ${open ? 'porta-panel-open' : 'porta-panel-closed'}`}
          style={{
            bottom: 96,
            right: 24,
            width: 'min(440px, calc(100vw - 48px))',
            height: 'min(660px, calc(100vh - 140px))',
            borderRadius: 24,
            boxShadow: '0 24px 48px -12px rgba(15, 36, 68, 0.35), 0 0 0 1px rgba(200, 164, 90, 0.15)',
          }}
        >
          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0 relative"
            style={{ background: 'linear-gradient(135deg, #0f2444 0%, #1a3a6b 60%, #264d82 100%)' }}>
            {/* Dekoratif parıltı */}
            <div className="absolute inset-0 opacity-30 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 20% 50%, rgba(200, 164, 90, 0.4), transparent 50%)' }} />

            <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-white relative z-10"
              style={{ border: '2px solid rgba(200, 164, 90, 0.7)' }}>
              <img src="/porta.png" alt="PORTA" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <p className="text-white font-semibold text-sm leading-none">PORTA</p>
              <p className="text-white/60 text-[11px] mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 porta-blink" />
                Çevrimiçi
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clear}
                title="Sohbeti temizle"
                className="text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 relative z-10"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              title="Kapat"
              className="text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 relative z-10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Context selector */}
          <div className="border-b px-4 py-2 flex items-center gap-2 flex-shrink-0"
            style={{ borderColor: '#f0ede8', background: '#faf8f4' }}>
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
            style={{ background: 'linear-gradient(180deg, #fefdfb 0%, #faf8f4 100%)' }}
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 porta-welcome">
                <div className="w-20 h-20 rounded-full overflow-hidden mb-4 bg-white relative"
                  style={{ border: '3px solid rgba(200, 164, 90, 0.4)' }}>
                  <img src="/porta.png" alt="PORTA" className="w-full h-full object-cover" />
                </div>
                <p className="text-base font-semibold text-navy">Merhaba, ben PORTA</p>
                <p className="text-xs text-muted mt-1.5 max-w-[260px]">
                  Portaldaki gerçek veriyle sorularınızı yanıtlarım. Aşağıdan hızlı başlayabilirsin.
                </p>
                <div className="mt-5 space-y-1.5 w-full">
                  {[
                    { t: 'Aktif projelerimin durumu?', c: 'project' as const },
                    { t: 'Açık yarışma fırsatları neler?', c: 'competitions' as const },
                    { t: 'Yeni bir proje nasıl açarım?', c: 'general' as const },
                  ].map((p, i) => (
                    <button
                      key={i}
                      onClick={() => { setContext(p.c); send(p.t, p.c); }}
                      className="w-full text-left text-xs px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#f0ede8] border transition-all hover:translate-x-1"
                      style={{ borderColor: '#e8e4dc' }}
                    >
                      {p.t}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex porta-msg-enter ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'text-white rounded-br-sm'
                        : m.error
                        ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                        : 'bg-white text-[#0f2444] rounded-bl-sm border'
                    }`}
                    style={
                      m.role === 'user'
                        ? { background: 'linear-gradient(135deg, #0f2444, #1a3a6b)' }
                        : !m.error
                        ? { borderColor: '#ece8e0' }
                        : {}
                    }
                  >
                    {m.role === 'assistant' ? (m.visible ?? '') : m.content}
                    {m.typing && (
                      <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-[#0f2444]/70 align-middle porta-caret" />
                    )}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start porta-msg-enter">
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2.5 border" style={{ borderColor: '#ece8e0' }}>
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
          <div className="border-t p-3 flex gap-2 bg-white flex-shrink-0" style={{ borderColor: '#f0ede8' }}>
            <textarea
              className="flex-1 resize-none rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-[#c8a45a]/30 focus:border-[#c8a45a] transition-all"
              style={{ borderColor: '#e8e4dc', minHeight: 40, maxHeight: 100 }}
              rows={1}
              placeholder="PORTA'ya bir şey sor..."
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
              className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex-shrink-0"
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

      <style jsx global>{`
        @keyframes porta-panel-in {
          0%   { opacity: 0; transform: translateY(24px) scale(0.94); }
          60%  { opacity: 1; transform: translateY(-4px) scale(1.01); }
          100% { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes porta-panel-out {
          0%   { opacity: 1; transform: translateY(0)   scale(1); }
          100% { opacity: 0; transform: translateY(16px) scale(0.96); }
        }
        .porta-panel-open  { animation: porta-panel-in  0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; transform-origin: bottom right; }
        .porta-panel-closed{ animation: porta-panel-out 0.25s ease-in  forwards; transform-origin: bottom right; }

        @keyframes porta-welcome-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .porta-welcome { animation: porta-welcome-in 0.5s 0.1s ease-out both; }

        @keyframes porta-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .porta-msg-enter { animation: porta-msg-in 0.25s ease-out; }

        @keyframes porta-caret {
          0%, 60%  { opacity: 1; }
          61%,100% { opacity: 0; }
        }
        .porta-caret { animation: porta-caret 0.85s steps(1) infinite; border-radius: 1px; }

        @keyframes porta-blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.85); }
        }
        .porta-blink { animation: porta-blink 1.8s ease-in-out infinite; }

        @keyframes porta-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(200, 164, 90, 0.55); }
          70%  { box-shadow: 0 0 0 16px rgba(200, 164, 90, 0);  }
          100% { box-shadow: 0 0 0 0 rgba(200, 164, 90, 0);     }
        }
        .porta-pulse {
          position: absolute; inset: 0; border-radius: 9999px; pointer-events: none;
          animation: porta-pulse 2.2s ease-out infinite;
        }

        .porta-fab:hover { transform: scale(1.08) !important; }
        .porta-fab:active { transform: scale(0.94) !important; }
      `}</style>
    </>
  );
}
