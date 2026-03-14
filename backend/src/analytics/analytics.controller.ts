import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@SkipThrottle()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private svc: AnalyticsService) {}

  @Get('overview')
  overview(@Query() q: any) { return this.svc.getOverview(q); }

  @Get('faculty-performance')
  facultyPerformance() { return this.svc.getFacultyPerformance(); }

  @Get('researcher-productivity')
  researcherProductivity(@Query() q: any) { return this.svc.getResearcherProductivity(q); }

  @Get('funding-success')
  fundingSuccess() { return this.svc.getFundingSuccess(); }

  @Get('budget-utilization')
  budgetUtilization() { return this.svc.getBudgetUtilization(); }

  @Get('timeline')
  timeline(@Query() q: any) { return this.svc.getTimeline(q); }

  @Get('export')
  exportData(@Query() q: any) { return this.svc.getExportData(q); }
}
