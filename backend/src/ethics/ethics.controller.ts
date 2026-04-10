import { Controller, Get, Post, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EthicsService } from './ethics.service';

@SkipThrottle()
@Controller('ethics')
@UseGuards(JwtAuthGuard)
export class EthicsController {
  constructor(private svc: EthicsService) {}

  @Post('analyze/:projectId')
  analyze(@Param('projectId') id: string) { return this.svc.initiateReview(id); }

  @Get('project/:projectId')
  getByProject(@Param('projectId') id: string) { return this.svc.getReviewByProject(id); }

  @Get('pending')
  getPending() { return this.svc.getPendingReviews(); }

  @Get('all')
  getAll() { return this.svc.getAllReviews(); }

  @Put('decision/:reviewId')
  submitDecision(
    @Param('reviewId') id: string,
    @Body() body: { decision: 'approved' | 'rejected'; note: string; approvalNumber?: string },
    @Request() req: any,
  ) { return this.svc.submitDecision(id, req.user.userId, body.decision, body.note, body.approvalNumber); }

  @Post('preview-analyze')
  previewAnalyze(@Body() body: { title: string; description: string; projectText: string; type: string }) {
    return this.svc.analyzeWithAi(body);
  }
}
