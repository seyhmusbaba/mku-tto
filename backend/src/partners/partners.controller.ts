import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PartnersService } from './partners.service';

@Controller('projects/:projectId/partners')
@UseGuards(JwtAuthGuard)
export class PartnersController {
  constructor(private svc: PartnersService) {}
  @Get() findAll(@Param('projectId') pid: string) { return this.svc.findByProject(pid); }
  @Post() create(@Param('projectId') pid: string, @Body() dto: any) { return this.svc.create(pid, dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}
