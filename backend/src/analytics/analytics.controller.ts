import { Controller, Get, Param, Query, UseGuards, Request, BadRequestException, NotFoundException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { BibliometricsService } from './bibliometrics.service';

@SkipThrottle()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private svc: AnalyticsService,
    private bibliometrics: BibliometricsService,
  ) {}

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

  // ── BIBLIOMETRICS ─────────────────────────────────────────────────────
  @Get('bibliometrics/researcher/:userId')
  async researcherBibliometrics(
    @Param('userId') userId: string,
    @Query('includeList') includeList?: string,
  ) {
    const r = await this.bibliometrics.getResearcher(userId, includeList === 'true');
    if (!r) throw new NotFoundException('Kullanıcı bulunamadı');
    return r;
  }

  @Get('bibliometrics/faculty')
  async facultyBibliometrics(@Query('faculty') faculty: string) {
    if (!faculty) throw new BadRequestException('faculty parametresi zorunlu');
    const r = await this.bibliometrics.getFaculty(faculty);
    if (!r) throw new NotFoundException('Fakülte bulunamadı veya araştırmacı yok');
    return r;
  }

  @Get('bibliometrics/institutional')
  async institutionalBibliometrics(@Query('year') year?: string) {
    const institutionId = await this.bibliometrics.findMkuInstitutionId();
    if (!institutionId) {
      return {
        configured: false,
        message: 'MKÜ için OpenAlex kurum kimliği bulunamadı. MKU_OPENALEX_ID env ile elle ayarlayabilirsiniz.',
      };
    }
    return this.bibliometrics.getInstitutional(institutionId, year ? +year : undefined);
  }
}
