import { Controller, Get, Post, Put, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EthicsService } from './ethics.service';

function hasEthicsAccess(roleName: string): boolean {
  const r = (roleName || '').toLowerCase();
  return r.includes('etik') || r.includes('admin') || r.includes('rekt') || r.includes('dekan');
}

@SkipThrottle()
@Controller('ethics')
@UseGuards(JwtAuthGuard)
export class EthicsController {
  constructor(private svc: EthicsService) {}

  // Proje kaydedilince analiz baslatir - herkes cagirabilir
  @Post('analyze/:projectId')
  analyze(@Param('projectId') id: string) {
    return this.svc.initiateReview(id);
  }

  // FIX #4: Force reanaliz - proje metni degismisse
  @Post('reanalyze/:projectId')
  reanalyze(@Param('projectId') id: string) {
    return this.svc.initiateReview(id, true);
  }

  // FIX #5: Karar iptal - yeniden pending'e al
  @Put('reopen/:reviewId')
  async reopen(@Param('reviewId') id: string, @Request() req: any) {
    const roleName = req.user.roleName || req.user.role?.name || '';
    if (!hasEthicsAccess(roleName)) throw new ForbiddenException('Etik kurul yetkisi gereklidir');
    return this.svc.reopenReview(id);
  }

  // Proje sahibi kendi projesinin etik durumunu gorebilir
  @Get('project/:projectId')
  async getByProject(@Param('projectId') id: string, @Request() req: any) {
    const roleName = req.user.roleName || req.user.role?.name || '';
    return this.svc.getReviewByProjectForUser(id, req.user.userId, roleName);
  }

  // Bekleyen incelemeler - etik kurul
  @Get('pending')
  async getPending(@Request() req: any) {
    const roleName = req.user.roleName || req.user.role?.name || '';
    if (!hasEthicsAccess(roleName)) throw new ForbiddenException('Etik kurul yetkisi gereklidir');
    return this.svc.getPendingReviews();
  }

  // Tum incelemeler - etik kurul
  @Get('all')
  async getAll(@Request() req: any) {
    const roleName = req.user.roleName || req.user.role?.name || '';
    if (!hasEthicsAccess(roleName)) throw new ForbiddenException('Etik kurul yetkisi gereklidir');
    return this.svc.getAllReviews();
  }

  // Karar ver
  @Put('decision/:reviewId')
  async submitDecision(
    @Param('reviewId') id: string,
    @Body() body: { decision: 'approved' | 'rejected'; note: string; approvalNumber?: string },
    @Request() req: any,
  ) {
    const roleName = req.user.roleName || req.user.role?.name || '';
    if (!hasEthicsAccess(roleName)) throw new ForbiddenException('Etik kurul yetkisi gereklidir');
    return this.svc.submitDecision(id, req.user.userId, body.decision, body.note, body.approvalNumber);
  }

  // On analiz - POLİTİKA: AI analizi devre dışı, her proje etik kurul onayı gerektirir.
  // Geriye uyumluluk için endpoint çağrılabilir ama sabit yanıt döner.
  @Post('preview-analyze')
  previewAnalyze() {
    return {
      required: true,
      riskScore: 100,
      reasons: ['Kurumsal politika - tüm projeler etik kurul onayı gerektirir'],
      recommendation: 'Etik kurul onayı zorunludur. Proje kaydedilince otomatik olarak incelemeye gönderilecektir.',
    };
  }
}
