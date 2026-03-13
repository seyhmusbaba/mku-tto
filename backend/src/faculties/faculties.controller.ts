import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FacultiesService } from './faculties.service';

@Controller('faculties')
export class FacultiesController {
  constructor(private svc: FacultiesService) {}

  // Public — kayıt formu ve proje formunda token olmadan erişilebilmeli
  @Get('active') findActive() { return this.svc.findActive(); }

  // Yönetici işlemleri — auth gerektirir
  @UseGuards(JwtAuthGuard) @Get() findAll() { return this.svc.findAll(); }
  @UseGuards(JwtAuthGuard) @Post() create(@Body() dto: any) { return this.svc.create(dto); }
  @UseGuards(JwtAuthGuard) @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }
  @UseGuards(JwtAuthGuard) @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}
