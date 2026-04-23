import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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

  @Get('search')
  search(@Query() q: any) {
    return this.svc.search(q);
  }
}
