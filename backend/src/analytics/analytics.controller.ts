import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@SkipThrottle()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private svc: AnalyticsService) {}

  @Get('overview')
  overview(@Query() q: any, @Request() req: any) {
    return this.svc.getOverview(q, req.user.userId, req.user.roleName);
  }

  @Get('faculty-performance')
  facultyPerformance(@Request() req: any) {
    return this.svc.getFacultyPerformance(req.user.userId, req.user.roleName);
  }

  @Get('researcher-productivity')
  researcherProductivity(@Query() q: any, @Request() req: any) {
    return this.svc.getResearcherProductivity(q, req.user.userId, req.user.roleName);
  }

  @Get('funding-success')
  fundingSuccess(@Request() req: any) {
    return this.svc.getFundingSuccess(req.user.userId, req.user.roleName);
  }

  @Get('budget-utilization')
  budgetUtilization(@Request() req: any) {
    return this.svc.getBudgetUtilization(req.user.userId, req.user.roleName);
  }

  @Get('timeline')
  timeline(@Query() q: any, @Request() req: any) {
    return this.svc.getTimeline(q, req.user.userId, req.user.roleName);
  }

  @Get('export')
  exportData(@Query() q: any, @Request() req: any) {
    return this.svc.getExportData(q, req.user.userId, req.user.roleName);
  }
}
