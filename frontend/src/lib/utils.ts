import { ProjectStatus } from '@/types';

export const FACULTIES = [
  'Mühendislik Fakültesi','Fen-Edebiyat Fakültesi','İktisadi ve İdari Bilimler Fakültesi',
  'Tıp Fakültesi','Diş Hekimliği Fakültesi','Eczacılık Fakültesi','Eğitim Fakültesi',
  'Güzel Sanatlar, Tasarım ve Mimarlık Fakültesi','Hukuk Fakültesi','İlahiyat Fakültesi',
  'Su Ürünleri Fakültesi','Tarım Bilimleri ve Teknolojileri Fakültesi','Veteriner Fakültesi',
  'Ziraat Fakültesi','Teknoloji Fakültesi','TTO','Diğer',
];

export const PROJECT_TYPES_DEFAULT = [
  { key:'tubitak', label:'TÜBİTAK', color:'#1d4ed8' },
  { key:'bap', label:'BAP', color:'#7c3aed' },
  { key:'eu', label:'AB Projesi', color:'#d97706' },
  { key:'industry', label:'Sanayi Projesi', color:'#ea580c' },
  { key:'other', label:'Diğer', color:'#64748b' },
];

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  application: 'Başvuru Sürecinde', active: 'Aktif', completed: 'Tamamlandı',
  pending: 'Başvuru Sürecinde', suspended: 'Askıya Alındı', cancelled: 'İptal Edildi',
};
export const PROJECT_STATUS_COLORS: Record<string, string> = {
  application: 'badge-yellow', active: 'badge-green', completed: 'badge-blue',
  pending: 'badge-yellow', suspended: 'badge-gray', cancelled: 'badge-red',
};

export const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Süper Admin':        { bg: '#fff0f0', text: '#dc2626', border: '#fecaca' },
  'Rektör':             { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
  'Dekan':              { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  'Bölüm Başkanı':      { bg: '#f0f9ff', text: '#075985', border: '#bae6fd' },
  'Akademisyen':        { bg: '#f0fdf4', text: '#14532d', border: '#bbf7d0' },
  'Araştırma Görevlisi':{ bg: '#faf5ff', text: '#581c87', border: '#e9d5ff' },
};

export const MEMBER_ROLE_LABELS: Record<string, string> = {
  researcher: 'Araştırmacı', coordinator: 'Koordinatör', advisor: 'Danışman', scholarship: 'Bursiyer', assistant: 'Asistan',
  technician: 'Teknisyen', analyst: 'Analist', observer: 'Gözlemci', other: 'Diğer',
};

export function getProjectTypeLabel(key: string, types?: { key: string; label: string }[]): string {
  if (types) { const found = types.find(t => t.key === key); if (found) return found.label; }
  const map: Record<string,string> = { tubitak:'TÜBİTAK', bap:'BAP', eu:'AB Projesi', industry:'Sanayi Projesi', other:'Diğer' };
  return map[key] || key;
}

export function getProjectTypeColor(key: string, types?: { key: string; color: string }[]): string {
  if (types) { const found = types.find(t => t.key === key); if (found) return found.color; }
  const map: Record<string,string> = { tubitak:'#1d4ed8', bap:'#7c3aed', eu:'#d97706', industry:'#ea580c', other:'#64748b' };
  return map[key] || '#64748b';
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' });
}
export function formatCurrency(amount: number | null | undefined) {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY', maximumFractionDigits:0 }).format(amount);
}
export function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0]||''}${lastName?.[0]||''}`.toUpperCase();
}
export function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Şimdi';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return formatDate(date);
}

// ─── Sürdürülebilir Kalkınma Hedefleri (SKH / SDG) ───────────────────────────
export const SDG_GOALS = [
  { id: 1,  code: 'SKH-1',  label: 'Yoksulluğa Son',                      color: '#E5243B', emoji: '🏘' },
  { id: 2,  code: 'SKH-2',  label: 'Açlığa Son',                           color: '#DDA63A', emoji: '🌾' },
  { id: 3,  code: 'SKH-3',  label: 'Sağlıklı ve Kaliteli Yaşam',           color: '#4C9F38', emoji: '💚' },
  { id: 4,  code: 'SKH-4',  label: 'Nitelikli Eğitim',                     color: '#C5192D', emoji: '📚' },
  { id: 5,  code: 'SKH-5',  label: 'Toplumsal Cinsiyet Eşitliği',          color: '#FF3A21', emoji: '⚖️' },
  { id: 6,  code: 'SKH-6',  label: 'Temiz Su ve Sanitasyon',               color: '#26BDE2', emoji: '💧' },
  { id: 7,  code: 'SKH-7',  label: 'Erişilebilir ve Temiz Enerji',         color: '#FCC30B', emoji: '⚡' },
  { id: 8,  code: 'SKH-8',  label: 'İnsana Yakışır İş ve Ekonomik Büyüme', color: '#A21942', emoji: '📈' },
  { id: 9,  code: 'SKH-9',  label: 'Sanayi, Yenilik ve Altyapı',           color: '#FD6925', emoji: '🏭' },
  { id: 10, code: 'SKH-10', label: 'Eşitsizliklerin Azaltılması',          color: '#DD1367', emoji: '🤝' },
  { id: 11, code: 'SKH-11', label: 'Sürdürülebilir Şehirler',              color: '#FD9D24', emoji: '🏙' },
  { id: 12, code: 'SKH-12', label: 'Sorumlu Üretim ve Tüketim',            color: '#BF8B2E', emoji: '♻️' },
  { id: 13, code: 'SKH-13', label: 'İklim Eylemi',                         color: '#3F7E44', emoji: '🌍' },
  { id: 14, code: 'SKH-14', label: 'Sudaki Yaşam',                         color: '#0A97D9', emoji: '🌊' },
  { id: 15, code: 'SKH-15', label: 'Karasal Yaşam',                        color: '#56C02B', emoji: '🌿' },
  { id: 16, code: 'SKH-16', label: 'Barış, Adalet ve Güçlü Kurumlar',     color: '#00689D', emoji: '⚖️' },
  { id: 17, code: 'SKH-17', label: 'Amaçlar İçin Ortaklıklar',            color: '#19486A', emoji: '🌐' },
] as const;

export type SdgCode = typeof SDG_GOALS[number]['code'];
export const SDG_MAP = Object.fromEntries(SDG_GOALS.map(g => [g.code, g]));

