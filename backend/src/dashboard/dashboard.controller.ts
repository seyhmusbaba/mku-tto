import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

const ADMIN_ROLES = ['Süper Admin', 'Dekan', 'Bölüm Başkanı'];

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@Request() req: any) {
    const roleName = req.user?.roleName || '';
    if (ADMIN_ROLES.includes(roleName)) {
      return this.dashboardService.getStats();
    }
    return this.dashboardService.getPersonalStats(req.user.userId);
  }
}
