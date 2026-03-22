import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExportService } from './export.service';

@SkipThrottle()
@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private svc: ExportService) {}

  @Get('projects/csv')
  async exportCsv(@Query() q: any, @Res() res: Response) {
    const csv = await this.svc.exportProjectsCsv(q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-16le');
    res.setHeader('Content-Disposition', 'attachment; filename="projeler.csv"; filename*=UTF-8''projeler.csv');
    res.send(csv);
  }

  @Get('projects/json')
  async exportJson(@Query() q: any) {
    return this.svc.exportProjectsJson(q);
  }
}
