import { Controller, Get, Post, Put, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EthicsService } from './ethics.service';

@SkipThrottle()
@Controller('ethics')
@UseGuards(JwtAuthGuard)
export class EthicsController {
  constructor(private svc: EthicsService) {}

  // Proje kaydedilince YZ analizi baslatir
  @Post('analyze/:projectId')
  analyze(@Param('projectId') id: string) {
    return this.svc.initiateReview(id);
  }

  // Proje sahibi kendi projesinin etik durumunu gorebilir
  @Get('project/:projectId')
  async getByProject(@Param('projectId') id: string, @Request() req: any) {
    return this.svc.getReviewByProjectForUser(id, req.user.userId, req.user.role?.name || '');
  }

  // Sadece etik kurul uyeleri + super admin bekleyen incelemeleri gorur
  @Get('pending')
  async getPending(@Request() req: any) {
    const role = req.user.role?.name || '';
    const isEthics = role.toLowerCase().includes('etik') || role === 'Super Admin';
    if (!isEthics) throw new ForbiddenException('Bu sayfaya erisim yetkiniz yok');
    return this.svc.getPendingReviews();
  }

  // Sadece etik kurul uyeleri + super admin tum incelemeleri gorur
  @Get('all')
  async getAll(@Request() req: any) {
    const role = req.user.role?.name || '';
    const isEthics = role.toLowerCase().includes('etik') || role === 'Super Admin';
    if (!isEthics) throw new ForbiddenException('Bu sayfaya erisim yetkiniz yok');
    return this.svc.getAllReviews();
  }

  // Etik kurul karar verir
  @Put('decision/:reviewId')
  async submitDecision(
    @Param('reviewId') id: string,
    @Body() body: { decision: 'approved' | 'rejected'; note: string; approvalNumber?: string },
    @Request() req: any,
  ) {
    const role = req.user.role?.name || '';
    const isEthics = role.toLowerCase().includes('etik') || role === 'Super Admin';
    if (!isEthics) throw new ForbiddenException('Etik kurul karari verme yetkiniz yok');
    return this.svc.submitDecision(id, req.user.userId, body.decision, body.note, body.approvalNumber);
  }

  // On analiz (proje formu icin - herkes kullanabilir)
  @Post('preview-analyze')
  previewAnalyze(@Body() body: { title: string; description: string; projectText: string; type: string }) {
    return this.svc.analyzeWithAi(body);
  }
}
