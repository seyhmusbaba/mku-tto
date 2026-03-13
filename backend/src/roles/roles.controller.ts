import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesService } from './roles.service';

@ApiTags('roles')
@Controller('roles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get() findAll() { return this.rolesService.findAll(); }
  @Get('permissions') findAllPermissions() { return this.rolesService.findAllPermissions(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.rolesService.findOne(id); }
  @Post() create(@Body() dto: any) { return this.rolesService.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.rolesService.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.rolesService.remove(id); }
}
