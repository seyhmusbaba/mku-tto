import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  // GET — herkese açık (logo/favicon/site adı login sayfasında da lazım)
  @Get()
  getAll() { return this.settingsService.getAll(); }

  // PUT — sadece giriş yapanlar
  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(@Body() data: any) { return this.settingsService.update(data); }
}
