import { Controller, Post, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BibliometricsSyncService } from './bibliometrics-sync.service';

const ADMIN_ROLES = ['Süper Admin', 'Admin', 'Rektör'];

@SkipThrottle()
@Controller('bibliometrics-sync')
@UseGuards(JwtAuthGuard)
export class BibliometricsSyncController {
  constructor(private svc: BibliometricsSyncService) {}

  /**
   * Kullanıcı kendi profilini senkronluyor → izinli.
   * Başka kullanıcı için → sadece admin.
   */
  @Post('user/:id')
  syncUser(@Param('id') id: string, @Request() req: any) {
    if (req.user.userId !== id && !ADMIN_ROLES.includes(req.user.roleName)) {
      throw new ForbiddenException('Başka kullanıcıyı senkronlayamazsınız');
    }
    return this.svc.syncUser(id);
  }

  /**
   * Admin: tüm aktif kullanıcıları toplu senkronla (cron uyumlu).
   */
  @Post('all')
  syncAll(@Request() req: any) {
    if (!ADMIN_ROLES.includes(req.user.roleName)) {
      throw new ForbiddenException('Bu işlem admin yetkisi gerektirir');
    }
    return this.svc.syncAll();
  }
}
