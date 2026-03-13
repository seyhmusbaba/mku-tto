import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportTypesService } from './report-types.service';

@Controller('report-types')
@UseGuards(JwtAuthGuard)
export class ReportTypesController {
  constructor(private svc: ReportTypesService) {}
  @Get() findAll() { return this.svc.findAll(); }
  @Get('active') findActive() { return this.svc.findActive(); }
  @Post() create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}
