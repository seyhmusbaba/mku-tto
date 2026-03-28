'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, facultiesApi } from '@/lib/api';
import { loadSettings, getSettings, subscribeSettings } from '@/lib/settings-store';
import toast from 'react-hot-toast';

type Mode = 'login' | 'register' | 'pending';


const TITLES = ['Prof. Dr.', 'Doç. Dr.', 'Dr. Öğr. Üyesi', 'Arş. Gör. Dr.', 'Arş. Gör.', 'Öğr. Gör.', 'Dr.'];

// Logo bileşeni aşağıda inline kullanılıyor

export default function LoginPage() {
  const [faculties, setFaculties] = useState<string[]>([]);
  const [siteName, setSiteName] = useState(() => getSettings().site_name || 'MKÜ TTO');
  const [footerText, setFooterText] = useState(() => getSettings().footer_text || `© ${new Date().getFullYear()} Hatay MKÜ Teknoloji Transfer Ofisi`);
  const [logoUrl, setLogoUrl] = useState(() => getSettings().logo_url || '');
  useEffect(() => {
    facultiesApi.getActive().then(r => setFaculties((r.data || []).map((f: any) => f.name))).catch(() => {});
    settingsApi.getAll().then(r => {
      const s = r.data || {};
      if (s.site_name) setSiteName(s.site_name);
      if (s.footer_text) setFooterText(s.footer_text);
      if (s.logo_url) setLogoUrl(s.logo_url);
      if (s.favicon_url) {
        let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = s.favicon_url;
      }
      if (s.site_name) document.title = `${s.site_name} - Proje Yönetim Sistemi`;
    }).catch(() => {});
  }, []);
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

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
    if (regForm.password !== regForm.confirmPassword) { toast.error('Şifreler eşleşmiyor'); return; }
    if (regForm.password.length < 6) { toast.error('Şifre en az 6 karakter olmalı'); return; }
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
                  <input type="password" required className="input" placeholder="••••••••"
                    value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} />
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
                  <input required type="password" className="input" placeholder="En az 6 karakter"
                    value={regForm.password} onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Şifre Tekrar *</label>
                  <input required type="password" className="input" placeholder="••••••••"
                    value={regForm.confirmPassword} onChange={e => setRegForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                </div>
                <p className="text-xs text-muted py-1 px-3 rounded-xl" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                  ℹ️ Kayıt sonrası hesabınız <strong>Akademisyen</strong> rolüyle açılır. Yöneticiniz rolünüzü değiştirebilir.
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
                <p className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wider">Sonraki Adımlar</p>
                <ul className="text-sm text-blue-800 space-y-1.5">
                  <li>✅ Kaydınız sisteme alındı</li>
                  <li>⏳ Yönetici hesabınızı inceleyecek</li>
                  <li>📧 Onay sonrası giriş yapabilirsiniz</li>
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
