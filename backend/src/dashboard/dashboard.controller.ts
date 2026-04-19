import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(@Request() req: any) {
    const roleName = req.user?.roleName || '';
    const scope = await this.dashboardService.resolveScopeForUser(req.user.userId, roleName);
    if (scope) {
      return this.dashboardService.getStats(scope);
    }
    return this.dashboardService.getPersonalStats(req.user.userId);
  }
}
