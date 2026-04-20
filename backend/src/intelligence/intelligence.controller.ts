import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IntelligenceService } from './intelligence.service';

@SkipThrottle()
@Controller('intelligence')
@UseGuards(JwtAuthGuard)
export class IntelligenceController {
  constructor(private readonly svc: IntelligenceService) {}

  @Get('target-journals')
  targetJournals(
    @Query('keywords') keywords?: string,
    @Query('title') title?: string,
    @Query('limit') limit?: string,
  ) {
    const kw = (keywords || '').split(',').map(s => s.trim()).filter(Boolean);
    return this.svc.getTargetJournals(kw, title, limit ? +limit : 10);
  }

  @Get('eu-opportunities')
  euOpportunities(@Query('keywords') keywords?: string) {
    const kw = (keywords || '').split(',').map(s => s.trim()).filter(Boolean);
    return this.svc.getEuOpportunities(kw);
  }

  @Get('global-similar')
  globalSimilar(
    @Query('title') title?: string,
    @Query('description') description?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getGlobalSimilar(title || '', description, limit ? +limit : 8);
  }

  @Get('patent-landscape')
  patentLandscape(@Query('keywords') keywords?: string) {
    const kw = (keywords || '').split(',').map(s => s.trim()).filter(Boolean);
    return this.svc.getPatentLandscape(kw);
  }

  @Get('potential-team')
  potentialTeam(
    @Query('keywords') keywords?: string,
    @Query('faculty') faculty?: string,
  ) {
    const kw = (keywords || '').split(',').map(s => s.trim()).filter(Boolean);
    return this.svc.getPotentialCollaborators(kw, faculty);
  }

  @Get('sdg-evidence')
  sdgEvidence(
    @Query('title') title?: string,
    @Query('description') description?: string,
  ) {
    return this.svc.getSdgEvidence(title || '', description);
  }

  @Get('success-estimate')
  successEstimate(
    @Query('type') type?: string,
    @Query('budget') budget?: string,
    @Query('durationMonths') durationMonths?: string,
  ) {
    return this.svc.getSuccessEstimate(
      type || '',
      budget ? +budget : undefined,
      durationMonths ? +durationMonths : undefined,
    );
  }

  @Get('turkey-benchmark')
  turkeyBenchmark(@Query('keywords') keywords?: string) {
    const kw = (keywords || '').split(',').map(s => s.trim()).filter(Boolean);
    return this.svc.getTurkeyBenchmark(kw);
  }

  @Get('concepts')
  concepts(
    @Query('title') title?: string,
    @Query('description') description?: string,
  ) {
    return this.svc.getConcepts(title || '', description);
  }

  @Get('checklist')
  checklist(@Query('type') type?: string) {
    return this.svc.getChecklist(type || '');
  }

  @Get('synthesis')
  synthesis(
    @Query('title') title?: string,
    @Query('description') description?: string,
    @Query('keywords') keywords?: string,
    @Query('type') type?: string,
    @Query('budget') budget?: string,
    @Query('faculty') faculty?: string,
  ) {
    const kw = (keywords || '').split(',').map(s => s.trim()).filter(Boolean);
    return this.svc.getSynthesis(
      title || '',
      description,
      kw,
      type,
      budget ? +budget : undefined,
      faculty,
    );
  }

  @Get('funding-simulator')
  fundingSimulator(
    @Query('type') type?: string,
    @Query('budget') budget?: string,
    @Query('durationMonths') durationMonths?: string,
    @Query('faculty') faculty?: string,
  ) {
    return this.svc.getFundingSimulation(
      type || '',
      budget ? +budget : undefined,
      durationMonths ? +durationMonths : undefined,
      faculty,
    );
  }

  @Get('collaboration-network')
  collaborationNetwork(@Query('userId') userId: string) {
    return this.svc.getCollaborationNetwork(userId);
  }
}
