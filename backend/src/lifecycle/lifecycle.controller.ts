import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LifecycleService } from './lifecycle.service';

@SkipThrottle()
@Controller('projects/:projectId/lifecycle')
@UseGuards(JwtAuthGuard)
export class LifecycleController {
  constructor(private svc: LifecycleService) {}

  @Get('summary')
  summary(@Param('projectId') pid: string) { return this.svc.getSummary(pid); }

  // ── Milestones ───────────────────────────────────────────
  @Get('milestones')
  listMs(@Param('projectId') pid: string) { return this.svc.listMilestones(pid); }

  @Post('milestones')
  createMs(@Param('projectId') pid: string, @Body() dto: any) { return this.svc.createMilestone(pid, dto); }

  @Put('milestones/:id')
  updateMs(@Param('id') id: string, @Body() dto: any) { return this.svc.updateMilestone(id, dto); }

  @Delete('milestones/:id')
  deleteMs(@Param('id') id: string) { return this.svc.deleteMilestone(id); }

  // ── Deliverables ────────────────────────────────────────
  @Get('deliverables')
  listDel(@Param('projectId') pid: string) { return this.svc.listDeliverables(pid); }

  @Post('deliverables')
  createDel(@Param('projectId') pid: string, @Body() dto: any) { return this.svc.createDeliverable(pid, dto); }

  @Put('deliverables/:id')
  updateDel(@Param('id') id: string, @Body() dto: any) { return this.svc.updateDeliverable(id, dto); }

  @Delete('deliverables/:id')
  deleteDel(@Param('id') id: string) { return this.svc.deleteDeliverable(id); }

  // ── Risks ───────────────────────────────────────────────
  @Get('risks')
  listRisks(@Param('projectId') pid: string) { return this.svc.listRisks(pid); }

  @Post('risks')
  createRisk(@Param('projectId') pid: string, @Body() dto: any) { return this.svc.createRisk(pid, dto); }

  @Put('risks/:id')
  updateRisk(@Param('id') id: string, @Body() dto: any) { return this.svc.updateRisk(id, dto); }

  @Delete('risks/:id')
  deleteRisk(@Param('id') id: string) { return this.svc.deleteRisk(id); }
}
