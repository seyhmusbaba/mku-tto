/**
 * Sistem rolleri - tek kaynak.
 *
 * NEDEN BURADA: Bu isimler eskiden tüm servislerde string literal olarak
 * dağınıktı (`'Süper Admin'`, `'Dekan'`, `'Bölüm Başkanı'`, ...). Tek bir
 * typo (örn. 'Super Admin' vs 'Süper Admin') tüm yetki kontrolünü kırardı.
 *
 * Bu modül artık sistem rollerinin TEK doğru kaynağıdır.
 * Yeni servis veya kontrol eklerken: import { ROLES } from '...' kullanın.
 *
 * Notlar:
 *  - İsimler TÜRKÇE; UI ve auth.service tarafından böyle yazılıyor.
 *  - DB'deki Role.name değeri buna BIREBIR uymak zorunda.
 *  - Yeni rol eklenecekse: aşağıdaki ROLES'e ekle + ROLE_GROUPS'u güncelle.
 */

export const ROLES = {
  SUPER_ADMIN:       'Süper Admin',
  REKTOR:            'Rektör',
  DEKAN:             'Dekan',
  BOLUM_BASKANI:     'Bölüm Başkanı',
  AKADEMISYEN:       'Akademisyen',
  ARASTIRMA_GOREVLI: 'Araştırma Görevlisi',
} as const;

export type RoleName = typeof ROLES[keyof typeof ROLES];

/**
 * Rol grupları - ortak yetki modelleri.
 */
export const ROLE_GROUPS = {
  /** Tüm sistemi görebilen / değiştirebilen */
  GLOBAL: [ROLES.SUPER_ADMIN, ROLES.REKTOR] as readonly RoleName[],

  /** Yönetici roller - kendi kapsamında full erişim */
  MANAGEMENT: [ROLES.SUPER_ADMIN, ROLES.REKTOR, ROLES.DEKAN, ROLES.BOLUM_BASKANI] as readonly RoleName[],

  /** Etik kurul yetkisine sahip - ethics alanlarını set edebilir */
  ETHICS_AUTHORITY: [ROLES.SUPER_ADMIN, ROLES.REKTOR, ROLES.DEKAN] as readonly RoleName[],
} as const;

/**
 * Yardımcılar - her zaman bunları kullan, string karşılaştırma YAPMA.
 */
export function isGlobalRole(roleName?: string | null): boolean {
  return !!roleName && (ROLE_GROUPS.GLOBAL as readonly string[]).includes(roleName);
}

export function isSuperAdmin(roleName?: string | null): boolean {
  return roleName === ROLES.SUPER_ADMIN;
}

export function isRektor(roleName?: string | null): boolean {
  return roleName === ROLES.REKTOR;
}

export function isDekan(roleName?: string | null): boolean {
  return roleName === ROLES.DEKAN;
}

export function isBolumBaskani(roleName?: string | null): boolean {
  return roleName === ROLES.BOLUM_BASKANI;
}

export function isEthicsAuthority(roleName?: string | null): boolean {
  return !!roleName && (ROLE_GROUPS.ETHICS_AUTHORITY as readonly string[]).includes(roleName);
}

export function isManagement(roleName?: string | null): boolean {
  return !!roleName && (ROLE_GROUPS.MANAGEMENT as readonly string[]).includes(roleName);
}
