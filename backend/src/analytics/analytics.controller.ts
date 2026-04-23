import { Controller, Get, Param, Query, UseGuards, Request, BadRequestException, NotFoundException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { BibliometricsService } from './bibliometrics.service';
import { InstitutionalService } from './institutional.service';

@SkipThrottle()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private svc: AnalyticsService,
    private bibliometrics: BibliometricsService,
    private institutional: InstitutionalService,
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
  async institutionalBibliometrics(
    @Query('year') year?: string,
    @Query('fromYear') fromYear?: string,
    @Query('toYear') toYear?: string,
  ) {
    const institutionId = await this.bibliometrics.findMkuInstitutionId();
    if (!institutionId) {
      return {
        configured: false,
        message: 'MKÜ için OpenAlex kurum kimliği bulunamadı. MKU_OPENALEX_ID env ile elle ayarlayabilirsiniz.',
      };
    }
    // Tek yıl mı, aralık mı?
    if (year) {
      return this.bibliometrics.getInstitutional(institutionId, +year);
    } else if (fromYear || toYear) {
      return this.bibliometrics.getInstitutional(institutionId, {
        from: fromYear ? +fromYear : undefined,
        to: toYear ? +toYear : undefined,
      });
    }
    return this.bibliometrics.getInstitutional(institutionId);
  }

  @Get('bibliometrics/peer-benchmark')
  async peerBenchmark() {
    return this.bibliometrics.getPeerBenchmark();
  }

  /**
   * Kullanıcıların tekil sync ettiği metriklerden kurumsal kaynak-bazlı
   * agrega (OpenAlex/Scopus/WoS/TR Dizin/Scholar/Sobiad ayrı ayrı toplam).
   */
  @Get('bibliometrics/user-sources')
  async userSourcesBreakdown() {
    return this.bibliometrics.getUserSourcesBreakdown();
  }

  @Get('bibliometrics/faculty-comparison')
  async facultyComparison() {
    return this.bibliometrics.getFacultyComparison();
  }

  @Get('bibliometrics/department-comparison')
  async departmentComparison(@Query('faculty') faculty: string, @Request() req: any) {
    // Dekan: parametre gönderilmezse kendi fakültesini DB'den al
    if (!faculty) {
      faculty = await this.bibliometrics.getUserFaculty(req.user.userId);
    }
    if (!faculty) throw new BadRequestException('faculty parametresi zorunlu (profilinizde fakülte tanımlı değilse elle gönderin)');
    return this.bibliometrics.getDepartmentComparison(faculty);
  }

  // ── INSTITUTIONAL COMPARISON ──────────────────────────────────────────
  @Get('institutional/faculty-radar')
  async facultyRadar() {
    return this.institutional.getFacultyRadar();
  }

  @Get('institutional/collaboration-matrix')
  async collaborationMatrix() {
    return this.institutional.getCollaborationMatrix();
  }

  @Get('institutional/sdg-heatmap')
  async sdgHeatmap() {
    return this.institutional.getSdgHeatmap();
  }
}
