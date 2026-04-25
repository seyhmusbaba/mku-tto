import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserPublicationsService } from './publications.service';

@SkipThrottle()
@Controller('user-publications')
@UseGuards(JwtAuthGuard)
export class UserPublicationsController {
  constructor(private svc: UserPublicationsService) {}

  @Get('user/:userId')
  list(@Param('userId') userId: string) {
    return this.svc.listForUser(userId);
  }

  @Get('my')
  myList(@Request() req: any) {
    return this.svc.listForUser(req.user.userId);
  }

  @Post()
  create(@Body() dto: any, @Request() req: any) {
    // Kendi adına ekler - admin başkası adına ekleyebilir
    const userId = dto.userId && req.user.roleName === 'Süper Admin' ? dto.userId : req.user.userId;
    return this.svc.create(userId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    const isAdmin = req.user.roleName === 'Süper Admin';
    return this.svc.update(id, req.user.userId, isAdmin, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    const isAdmin = req.user.roleName === 'Süper Admin';
    return this.svc.remove(id, req.user.userId, isAdmin);
  }

  @Post(':id/toggle-featured')
  toggleFeatured(@Param('id') id: string, @Request() req: any) {
    const isAdmin = req.user.roleName === 'Süper Admin';
    return this.svc.toggleFeatured(id, req.user.userId, isAdmin);
  }
}
