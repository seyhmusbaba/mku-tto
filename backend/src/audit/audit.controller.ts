import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private svc: AuditService) {}

  @Get('project/:projectId')
  getByProject(@Param('projectId') id: string) {
    return this.svc.getByEntity('project', id);
  }

  @Get('recent')
  getRecent(@Query('limit') limit?: string) {
    return this.svc.getRecent(limit ? +limit : 100);
  }

  /**
   * Role-based dashboard feed.
   * - Akademisyen → kendi projeleri
   * - Bölüm Başkanı → bölüm projeleri
   * - Dekan → fakülte projeleri
   * - Süper Admin / Rektör → tümü
   */
  @Get('feed')
  feed(@Request() req: any, @Query('limit') limit?: string) {
    return this.svc.getFeed(req.user.userId, limit ? +limit : 20);
  }

  @Get('search')
  search(@Query() q: any) {
    return this.svc.search(q);
  }
}
