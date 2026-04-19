import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesService } from './roles.service';

@ApiTags('roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get() findAll() { return this.rolesService.findAll(); }
  @Get('permissions') findAllPermissions() { return this.rolesService.findAllPermissions(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.rolesService.findOne(id); }
  @Roles('Süper Admin')
  @Post() create(@Body() dto: any) { return this.rolesService.create(dto); }
  @Roles('Süper Admin')
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.rolesService.update(id, dto); }
  @Roles('Süper Admin')
  @Delete(':id') remove(@Param('id') id: string) { return this.rolesService.remove(id); }
}
