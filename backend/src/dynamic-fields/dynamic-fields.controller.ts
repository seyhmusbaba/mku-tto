import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DynamicFieldsService } from './dynamic-fields.service';

@ApiTags('dynamic-fields')
@Controller('dynamic-fields')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DynamicFieldsController {
  constructor(private dynamicFieldsService: DynamicFieldsService) {}

  @Get() findAll() { return this.dynamicFieldsService.findAll(); }
  @Get('admin') findAllAdmin() { return this.dynamicFieldsService.findAllAdmin(); }
  @Post() create(@Body() dto: any) { return this.dynamicFieldsService.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.dynamicFieldsService.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.dynamicFieldsService.remove(id); }
}
