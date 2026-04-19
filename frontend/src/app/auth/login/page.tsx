'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, facultiesApi } from '@/lib/api';
import { loadSettings, getSettings } from '@/lib/settings-store';
import toast from 'react-hot-toast';

type Mode = 'login' | 'register' | 'pending';

/* ─── Icon helper ───────────────────────────────────── */
type LIconName = 'check' | 'clock' | 'mail' | 'info' | 'eye' | 'eye-off' | 'alert';
const L_I: Record<LIconName, string> = {
  check:    'M5 13l4 4L19 7',
  clock:    'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  mail:     'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  info:     'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  eye:      'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  'eye-off':'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L3 3m6.88 6.88l4.24 4.24m0 0L21 21',
  alert:    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
};
function LIcon({ name, className = 'w-4 h-4', strokeWidth = 1.8 }: { name: LIconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={L_I[name]} />
    </svg>
  );
}

const TITLES = ['Prof. Dr.', 'Doç. Dr.', 'Dr. Öğr. Üyesi', 'Arş. Gör. Dr.', 'Arş. Gör.', 'Öğr. Gör.', 'Dr.'];

// Logo bileşeni aşağıda inline kullanılıyor

export default function LoginPage() {
  const [faculties, setFaculties] = useState<string[]>([]);
  const [siteName, setSiteName] = useState(() => getSettings().site_name || 'MKÜ TTO');
  const [footerText, setFooterText] = useState(() => getSettings().footer_text || `© ${new Date().getFullYear()} Hatay MKÜ Teknoloji Transfer Ofisi`);
  const [logoUrl, setLogoUrl] = useState(() => getSettings().logo_url || '');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  useEffect(() => {
    facultiesApi.getActive().then(r => setFaculties((r.data || []).map((f: any) => f.name))).catch(() => {});
    const applySettings = (s: any) => {
      if (s.site_name) setSiteName(s.site_name);
      if (s.footer_text) setFooterText(s.footer_text);
      if (s.logo_url) setLogoUrl(s.logo_url);
      if (s.favicon_url) {
        let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = s.favicon_url;
      }
      if (s.site_name) document.title = s.site_name + ' - Proje Yönetim Sistemi';
    };
    applySettings(getSettings());
    loadSettings().then(applySettings).catch(() => {});
  }, []);
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const { login, register, user, token } = useAuth();
  const router = useRouter();

  // Zaten giriş yapmışsa dashboard'a yönlendir
  useEffect(() => {
    if (user && token) router.replace('/dashboard');
  }, [user, token, router]);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    title: '', faculty: '', department: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'E-posta veya şifre hatalı');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regForm.email)) { toast.error('Geçersiz e-posta adresi'); return; }
    if (regForm.password !== regForm.confirmPassword) { toast.error('Şifreler eşleşmiyor'); return; }
    if (regForm.password.length < 8) { toast.error('Şifre en az 8 karakter olmalı'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        firstName: regForm.firstName,
        lastName: regForm.lastName,
        email: regForm.email,
        password: regForm.password,
        title: regForm.title || undefined,
        faculty: regForm.faculty || undefined,
        department: regForm.department || undefined,
      });
      if (res.data?.pending) {
        setMode('pending');
      } else {
        toast.success('Hesabınız oluşturuldu, hoş geldiniz!');
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Kayıt başarısız, lütfen tekrar deneyin');
    } finally { setLoading(false); }
  };

  const SpinBtn = ({ label, loadingLabel }: { label: string; loadingLabel: string }) => (
    <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base font-semibold">
      {loading
        ? <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {loadingLabel}
          </span>
        : label}
    </button>
  );

  return (
    <div className="min-h-screen flex" style={{ background: '#faf8f4' }}>

      {/* ── Sol dekoratif panel ── */}
      <div className="hidden lg:flex lg:w-[460px] flex-col relative overflow-hidden flex-shrink-0"
        style={{ background: 'linear-gradient(160deg,#0f2444 0%,#0a1a30 60%,#1a3a6b 100%)' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-5"
            style={{ background: 'radial-gradient(circle,#c8a45a,transparent)', transform: 'translate(30%,-30%)' }} />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle,#c8a45a,transparent)', transform: 'translate(-40%,40%)' }} />
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]">
            <defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#g)" />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col h-full p-12">
          <div className="mb-auto">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#c8a45a,#e8c97a)' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
              )}
              <span className="font-display font-bold text-xl text-white">{siteName}</span>
            </div>
          </div>
          <div className="mb-auto">
            <h1 className="font-display text-4xl font-bold text-white leading-tight mb-4">
              Teknoloji<br />Transfer Ofisi<br />
              <span style={{ color: '#c8a45a' }}>Proje Yönetimi</span>
            </h1>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              Hatay Mustafa Kemal Üniversitesi'nin akademik araştırma projelerini tek platformda yönetin.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['100+', 'Aktif Proje'], ['250+', 'Akademisyen'], ['₺50M+', 'Toplam Bütçe']].map(([v, l]) => (
              <div key={l} className="rounded-xl p-4 text-center"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="font-display text-xl font-bold" style={{ color: '#c8a45a' }}>{v}</div>
                <div className="text-white/40 text-xs mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sağ form paneli ── */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-sm py-8">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="w-8 h-8 rounded-xl object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0f2444,#1a3a6b)' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
              )}
              <span className="font-display font-bold text-lg text-navy">{siteName}</span>
            </div>
          </div>

          {/* Mode switcher */}
          <div className="flex rounded-2xl p-1 mb-8" style={{ background: '#f0ede8', border: '1px solid #e8e4dc' }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: mode === m ? 'white' : 'transparent',
                  color: mode === m ? '#0f2444' : '#9ca3af',
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                {m === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </button>
            ))}
          </div>

          {/* ── GİRİŞ ── */}
          {mode === 'login' && (
            <>
              <div className="mb-6">
                <h2 className="font-display text-2xl font-semibold text-navy">Hoş Geldiniz</h2>
                <p className="text-sm text-muted mt-1">Sisteme erişmek için bilgilerinizi girin</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label">E-posta</label>
                  <input type="email" required className="input" placeholder="ad.soyad@mku.edu.tr"
                    value={loginForm.email} onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Şifre</label>
                  <div className="relative">
                    <input type={showLoginPw ? 'text' : 'password'} required className="input pr-10" placeholder="••••••••"
                      value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} />
                    <button type="button" onClick={() => setShowLoginPw(v => !v)}
                      aria-label={showLoginPw ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-navy">
                      <LIcon name={showLoginPw ? 'eye-off' : 'eye'} className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="pt-1">
                  <SpinBtn label="Giriş Yap" loadingLabel="Giriş yapılıyor..." />
                </div>
              </form>
              <p className="text-center text-sm text-muted mt-6">
                Hesabınız yok mu?{' '}
                <button onClick={() => setMode('register')} className="font-semibold" style={{ color: '#1a3a6b' }}>
                  Kayıt olun
                </button>
              </p>
            </>
          )}

          {/* ── KAYIT ── */}
          {mode === 'register' && (
            <>
              <div className="mb-6">
                <h2 className="font-display text-2xl font-semibold text-navy">Hesap Oluştur</h2>
                <p className="text-sm text-muted mt-1">Akademik bilgilerinizi girerek kayıt olun</p>
              </div>
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Ad *</label>
                    <input required className="input" placeholder="Ahmet"
                      value={regForm.firstName} onChange={e => setRegForm(f => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Soyad *</label>
                    <input required className="input" placeholder="Yılmaz"
                      value={regForm.lastName} onChange={e => setRegForm(f => ({ ...f, lastName: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Kurumsal E-posta *</label>
                  <input required type="email" className="input" placeholder="ad.soyad@mku.edu.tr"
                    value={regForm.email} onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Unvan</label>
                  <select className="input" value={regForm.title} onChange={e => setRegForm(f => ({ ...f, title: e.target.value }))}>
                    <option value="">Seçiniz...</option>
                    {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fakülte</label>
                  <select className="input" value={regForm.faculty} onChange={e => setRegForm(f => ({ ...f, faculty: e.target.value }))}>
                    <option value="">Seçiniz...</option>
                    {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Bölüm</label>
                  <input className="input" placeholder="Bilgisayar Mühendisliği"
                    value={regForm.department} onChange={e => setRegForm(f => ({ ...f, department: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Şifre *</label>
                  <div className="relative">
                    <input required minLength={8} type={showRegPw ? 'text' : 'password'} className="input pr-10" placeholder="En az 8 karakter"
                      value={regForm.password} onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))} />
                    <button type="button" onClick={() => setShowRegPw(v => !v)}
                      aria-label={showRegPw ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-navy">
                      <LIcon name={showRegPw ? 'eye-off' : 'eye'} className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Şifre Tekrar *</label>
                  <input required type={showRegPw ? 'text' : 'password'} className="input" placeholder="••••••••"
                    value={regForm.confirmPassword} onChange={e => setRegForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                  {regForm.confirmPassword && regForm.password !== regForm.confirmPassword && (
                    <p className="text-xs mt-1 inline-flex items-center gap-1 text-red-600">
                      <LIcon name="alert" className="w-3 h-3" />
                      Şifreler eşleşmiyor
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted py-2 px-3 rounded-xl inline-flex items-start gap-1.5 w-full" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                  <LIcon name="info" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Kayıt sonrası hesabınız <strong>Akademisyen</strong> rolüyle açılır. Yöneticiniz rolünüzü değiştirebilir.</span>
                </p>
                <div className="pt-1">
                  <SpinBtn label="Kayıt Ol" loadingLabel="Kaydediliyor..." />
                </div>
              </form>
              <p className="text-center text-sm text-muted mt-4">
                Zaten hesabınız var mı?{' '}
                <button onClick={() => setMode('login')} className="font-semibold" style={{ color: '#1a3a6b' }}>
                  Giriş yapın
                </button>
              </p>
            </>
          )}

          {/* ── ONAY BEKLENİYOR ── */}
          {mode === 'pending' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: '#fffbeb', border: '2px solid #fde68a' }}>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
              </div>
              <h2 className="font-display text-xl font-bold text-navy mb-2">Başvurunuz Alındı</h2>
              <p className="text-sm text-muted mb-6 leading-relaxed">
                Kaydınız başarıyla oluşturuldu. Sisteme erişebilmek için<br />
                <strong>yönetici onayı</strong> gerekmektedir.
              </p>
              <div className="rounded-2xl p-5 mb-6 text-left" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <p className="text-xs font-bold text-blue-700 mb-3 uppercase tracking-wider">Sonraki Adımlar</p>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start gap-2">
                    <LIcon name="check" className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" strokeWidth={2.2} />
                    <span>Kaydınız sisteme alındı</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <LIcon name="clock" className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                    <span>Yönetici hesabınızı inceleyecek</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <LIcon name="mail" className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
                    <span>Onay sonrası giriş yapabilirsiniz</span>
                  </li>
                </ul>
              </div>
              <button onClick={() => setMode('login')} className="btn-primary w-full py-3">
                Giriş Ekranına Dön
              </button>
            </div>
          )}

          <p className="text-center text-xs text-muted mt-10">
            {footerText}
          </p>
        </div>
      </div>
    </div>
  );
}
