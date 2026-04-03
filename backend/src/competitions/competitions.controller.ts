import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompetitionsService } from './competitions.service';

@SkipThrottle()
@Controller('competitions')
@UseGuards(JwtAuthGuard)
export class CompetitionsController {
  constructor(private svc: CompetitionsService) {}

  // Yarışmalar
  @Get() findAll(@Query() q: any) { return this.svc.findAll(q); }
  @Get('stats') getStats() { return this.svc.getStats(); }
  @Get('schedule-info') getScheduleInfo() {
    return {
      enabled: true,
      interval: 'Her 6 saatte bir (00:00, 06:00, 12:00, 18:00)',
      nextRuns: ['00:00', '06:00', '12:00', '18:00'],
      message: 'Kaynaklar her 6 saatte bir otomatik taranır. Yeni duyuru bulunursa tüm kullanıcılara bildirim gider.'
    };
  }
  @Get('fetch') fetchFromSources() { return this.svc.fetchFromSources(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Post() create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }

  // Kaynaklar
  @Get('sources/list') getSources() { return this.svc.getSources(); }
  @Post('sources/test') testSource(@Body() body: { url: string }) { return this.svc.testSource(body.url); }
  @Post('sources') createSource(@Body() dto: any) { return this.svc.createSource(dto); }
  @Put('sources/:id') updateSource(@Param('id') id: string, @Body() dto: any) { return this.svc.updateSource(id, dto); }
  @Delete('sources/:id') deleteSource(@Param('id') id: string) { return this.svc.deleteSource(id); }
}
