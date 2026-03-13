'use client';
import { useState } from 'react';

interface ReportTemplate {
  type: string;
  label: string;
  icon: string;
  description: string;
  fields: Array<{ label: string; placeholder?: string; type?: 'text' | 'textarea' | 'number' | 'select'; options?: string[] }>;
}

const TEMPLATES: ReportTemplate[] = [
  {
    type: 'progress', label: 'İlerleme Raporu', icon: '📊', description: 'Periyodik proje ilerleme kaydı',
    fields: [
      { label: 'Raporlama Dönemi', placeholder: 'Örn: Ocak - Mart 2025' },
      { label: 'Gerçekleştirilen Faaliyetler', type: 'textarea', placeholder: 'Bu dönemde yapılan çalışmalar...' },
      { label: 'İlerleme Yüzdesi (%)', type: 'number', placeholder: '0-100' },
      { label: 'Karşılaşılan Zorluklar', type: 'textarea', placeholder: 'Yaşanan sorunlar ve engeller...' },
      { label: 'Sonraki Dönem Planları', type: 'textarea', placeholder: 'Planlanan faaliyetler...' },
    ],
  },
  {
    type: 'financial', label: 'Finansal Rapor', icon: '💰', description: 'Bütçe kullanım ve harcama raporu',
    fields: [
      { label: 'Raporlama Dönemi', placeholder: 'Örn: Q1 2025' },
      { label: 'Toplam Bütçe (₺)', type: 'number', placeholder: '0' },
      { label: 'Dönem Harcaması (₺)', type: 'number', placeholder: '0' },
      { label: 'Kümülatif Harcama (₺)', type: 'number', placeholder: '0' },
      { label: 'Kalan Bütçe (₺)', type: 'number', placeholder: '0' },
      { label: 'Sapma Açıklaması', type: 'textarea', placeholder: 'Bütçe sapması varsa nedenleri...' },
    ],
  },
  {
    type: 'milestone', label: 'Kilometre Taşı Raporu', icon: '🏁', description: 'Kritik proje dönüm noktası kaydı',
    fields: [
      { label: 'Kilometre Taşı Adı', placeholder: 'Örn: Prototip Tamamlandı' },
      { label: 'Planlanan Tarih', placeholder: 'GG.AA.YYYY' },
      { label: 'Gerçekleşme Tarihi', placeholder: 'GG.AA.YYYY' },
      { label: 'Durumu', type: 'select', options: ['Zamanında Tamamlandı', 'Gecikmeli Tamamlandı', 'Devam Ediyor', 'İptal Edildi'] },
      { label: 'Sorumlu Kişi/Birim', placeholder: 'Ad Soyad / Birim' },
      { label: 'Etkisi / Önemi', type: 'textarea', placeholder: 'Bu kilometre taşının proje için önemi...' },
    ],
  },
  {
    type: 'technical', label: 'Teknik Rapor', icon: '🔬', description: 'Ar-Ge bulguları ve teknik sonuçlar',
    fields: [
      { label: 'Araştırma Konusu', placeholder: 'İncelenen konu veya problem' },
      { label: 'Kullanılan Metodoloji', type: 'textarea', placeholder: 'Araştırma yöntemi ve yaklaşımı...' },
      { label: 'Bulgular ve Sonuçlar', type: 'textarea', placeholder: 'Elde edilen teknik sonuçlar...' },
      { label: 'Öneriler', type: 'textarea', placeholder: 'Gelecek çalışmalar için öneriler...' },
      { label: 'Kaynakça / Referanslar', type: 'textarea', placeholder: 'Kullanılan kaynaklar...' },
    ],
  },
  {
    type: 'risk', label: 'Risk Raporu', icon: '⚠️', description: 'Proje risk değerlendirmesi ve izleme',
    fields: [
      { label: 'Risk Adı / Tanımı', placeholder: 'Riskin kısa tanımı' },
      { label: 'Risk Kategorisi', type: 'select', options: ['Teknik', 'Finansal', 'Organizasyonel', 'Yasal', 'Dış Çevre'] },
      { label: 'Olasılık', type: 'select', options: ['Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'] },
      { label: 'Etki', type: 'select', options: ['Çok Düşük', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'] },
      { label: 'Azaltma Stratejisi', type: 'textarea', placeholder: 'Riski azaltmak için alınacak önlemler...' },
      { label: 'Kontenjans Planı', type: 'textarea', placeholder: 'Risk gerçekleşirse yapılacaklar...' },
      { label: 'Sorumlu Kişi', placeholder: 'Ad Soyad' },
    ],
  },
  {
    type: 'final', label: 'Final Raporu', icon: '🎯', description: 'Proje kapanış ve değerlendirme raporu',
    fields: [
      { label: 'Proje Özeti', type: 'textarea', placeholder: 'Projenin genel değerlendirmesi...' },
      { label: 'Başarılar ve Çıktılar', type: 'textarea', placeholder: 'Elde edilen başarılar ve üretilen çıktılar...' },
      { label: 'Öğrenilen Dersler', type: 'textarea', placeholder: 'Neler iyi gitti? Neler farklı yapılabilirdi?' },
      { label: 'Öneriler', type: 'textarea', placeholder: 'Gelecek projeler için tavsiyeler...' },
      { label: 'Yayın / Patent', type: 'select', options: ['Yok', 'Gönderildi', 'Yayınlandı', 'Patent Alındı'] },
      { label: 'Sürdürülebilirlik Değerlendirmesi', type: 'textarea', placeholder: 'Projenin sürdürülebilirliği hakkında...' },
    ],
  },
];

function generateHTML(template: ReportTemplate, projectTitle: string): string {
  const fields = template.fields.map(f => {
    const inputHtml = f.type === 'textarea'
      ? `<textarea style="width:100%;border:1px solid #ccc;border-radius:6px;padding:10px;font-family:inherit;font-size:13px;min-height:80px;resize:vertical;" placeholder="${f.placeholder || ''}">${''}</textarea>`
      : f.type === 'select'
      ? `<select style="width:100%;border:1px solid #ccc;border-radius:6px;padding:10px;font-family:inherit;font-size:13px;"><option value="">Seçiniz...</option>${(f.options || []).map(o => `<option>${o}</option>`).join('')}</select>`
      : `<input type="${f.type === 'number' ? 'number' : 'text'}" style="width:100%;border:1px solid #ccc;border-radius:6px;padding:10px;font-family:inherit;font-size:13px;box-sizing:border-box;" placeholder="${f.placeholder || ''}" />`;
    return `
      <div style="margin-bottom:18px;">
        <label style="display:block;font-weight:600;font-size:13px;color:#374151;margin-bottom:6px;">${f.label}</label>
        ${inputHtml}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${template.label} - ${projectTitle}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 30px; }
  .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 20px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #0f2444, #1a3a6b); padding: 32px 36px; color: white; }
  .header-icon { font-size: 36px; margin-bottom: 8px; }
  .header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
  .header p { margin: 0; opacity: 0.7; font-size: 14px; }
  .meta { background: #f8f6f2; padding: 16px 36px; display: flex; gap: 32px; border-bottom: 1px solid #e8e4dc; }
  .meta-item label { display: block; font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .meta-item span { font-size: 13px; font-weight: 600; color: #1f2937; }
  .meta-item input { border: none; background: transparent; font-size: 13px; font-weight: 600; color: #1f2937; font-family: inherit; width: 180px; padding: 0; }
  .body { padding: 36px; }
  .section-title { font-size: 16px; font-weight: 700; color: #0f2444; margin: 0 0 24px; padding-bottom: 10px; border-bottom: 2px solid #e8e4dc; }
  @media print {
    body { background: white; padding: 0; }
    .container { box-shadow: none; border-radius: 0; }
    input, textarea, select { border-color: #999 !important; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="header-icon">${template.icon}</div>
    <h1>${template.label}</h1>
    <p>${template.description}</p>
  </div>
  <div class="meta">
    <div class="meta-item"><label>Proje Adı</label><span>${projectTitle}</span></div>
    <div class="meta-item"><label>Rapor Tarihi</label><input type="text" value="${new Date().toLocaleDateString('tr-TR')}" /></div>
    <div class="meta-item"><label>Hazırlayan</label><input type="text" placeholder="Ad Soyad" /></div>
  </div>
  <div class="body">
    <h2 class="section-title">${template.icon} ${template.label} Bilgileri</h2>
    ${fields}
    <div style="margin-top:32px;padding-top:20px;border-top:2px solid #e8e4dc;">
      <p style="font-size:12px;color:#9ca3af;text-align:center;">Bu belge MKÜ Teknoloji Transfer Ofisi Proje Yönetim Sistemi tarafından oluşturulmuştur.</p>
    </div>
  </div>
</div>
<script>
  window.onload = function() {
    document.querySelectorAll('input[type="text"]').forEach(function(el) {
      el.style.borderBottom = '1px solid #ccc';
      el.style.padding = '2px 4px';
    });
  };
<\/script>
</body>
</html>`;
}

interface DownloaderProps {
  projectTitle: string;
}

export function ReportTemplateDownloader({ projectTitle }: DownloaderProps) {
  const [open, setOpen] = useState(false);

  const download = (template: ReportTemplate) => {
    const html = generateHTML(template, projectTitle);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.label.replace(/\s+/g, '_')}_Sablon.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} type="button"
        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Rapor Şablonu İndir
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-72 bg-white rounded-2xl shadow-navy z-30"
          style={{ border: '1px solid #e8e4dc' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#f0ede8' }}>
            <span className="font-semibold text-sm text-navy">Şablon Seçin</span>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-navy text-xs">✕</button>
          </div>
          <div className="p-2">
            {TEMPLATES.map(t => (
              <button key={t.type} onClick={() => { download(t); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-cream transition-colors text-left group">
                <span className="text-xl">{t.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-navy">{t.label}</p>
                  <p className="text-xs text-muted">{t.description}</p>
                </div>
                <svg className="w-4 h-4 text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            ))}
          </div>
          <div className="px-4 py-3 border-t" style={{ borderColor: '#f0ede8' }}>
            <p className="text-xs text-muted text-center">HTML formatında indirilir, tarayıcıdan yazıcıyla yazdırabilirsiniz</p>
          </div>
        </div>
      )}
    </div>
  );
}