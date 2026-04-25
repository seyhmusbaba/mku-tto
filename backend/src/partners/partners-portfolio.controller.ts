import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PartnersService } from './partners.service';

/**
 * Kurumsal partner portföyü - kurum bazlı agregasyon, yenileme takibi.
 * Project scope dışı, tüm partnerleri kapsar.
 */
@SkipThrottle()
@Controller('partners')
@UseGuards(JwtAuthGuard)
export class PartnersPortfolioController {
  constructor(private svc: PartnersService) {}

  @Get()
  listAll(@Query() q: any) {
    return this.svc.listAll(q);
  }

  @Get('by-organization')
  byOrganization() {
    return this.svc.listByOrganization();
  }

  @Get('contracts-expiring')
  contractsExpiring(@Query('days') days?: string) {
    return this.svc.contractsExpiring(days ? +days : 30);
  }
}
