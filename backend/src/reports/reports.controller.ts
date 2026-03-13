import { Controller, Get, Post, Put, Delete, Param, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('projects')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get(':projectId/reports')
  findAll(@Param('projectId') projectId: string) {
    return this.reportsService.findByProject(projectId);
  }

  @Post(':projectId/reports')
  create(@Param('projectId') projectId: string, @Request() req: any, @Body() dto: any) {
    return this.reportsService.create(projectId, req.user.userId, dto);
  }

  @Put('reports/:id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.reportsService.update(id, dto);
  }

  @Delete('reports/:id')
  remove(@Param('id') id: string) {
    return this.reportsService.remove(id);
  }
}
