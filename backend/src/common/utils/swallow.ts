/**
 * Hata yutmayan "soft fail" yardımcısı.
 *
 * NEDEN: Kod tabanında 100+ yerde `.catch(() => {})` kullanılıyor. Bu hatalar
 * sessiz şekilde gizleniyor → ne kadar API patlıyor, ne kadar entegrasyon
 * çalışmıyor görünmüyor. Sentry veya başka bir error monitor olmadığı için
 * en azından NestJS Logger'a düşüyor olsun.
 *
 * KULLANIM:
 *   await someAction().catch(swallow(logger, 'someAction:context'));
 *   // veya
 *   await someAction().catch(e => swallowed(logger, 'someAction', e));
 */
import { Logger } from '@nestjs/common';

export function swallow(logger: Logger, context: string) {
  return (e: any) => {
    const msg = e?.message || String(e);
    logger.warn(`[swallow:${context}] ${msg}`);
    return undefined;
  };
}

export function swallowed(logger: Logger, context: string, e: any) {
  const msg = e?.message || String(e);
  logger.warn(`[swallow:${context}] ${msg}`);
}

/**
 * Critical hatalar için - error seviyesi + stacktrace.
 */
export function swallowCritical(logger: Logger, context: string) {
  return (e: any) => {
    const msg = e?.message || String(e);
    logger.error(`[CRITICAL:${context}] ${msg}`, e?.stack);
    return undefined;
  };
}
