import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get() findAll(@Query() query: any) { return this.usersService.findAll(query); }
  @Get('me') getMe(@Request() req: any) { return this.usersService.findOne(req.user.userId); }
  @Get('pending/list') getPending() { return this.usersService.findPending(); }
  @Get(':id') findOne(@Param('id') id: string, @Request() req: any) {
    // Profil ziyaretini kaydet (kendi profilini ziyaret etmiyorsa)
    if (req.user.userId !== id) {
      this.usersService.recordVisit(id, req.user.userId).catch(() => {});
    }
    return this.usersService.findOne(id);
  }
  @Get(':id/projects') getUserProjects(@Param('id') id: string) { return this.usersService.findUserProjects(id); }
  @Get(':id/visitors') getVisitors(@Param('id') id: string, @Request() req: any) {
    // Sadece kendi profil ziyaretçilerini görebilir veya admin
    return this.usersService.getRecentVisitors(id);
  }
  @Post() create(@Body() dto: any) { return this.usersService.create(dto); }
  @Put('me/avatar') updateMyAvatar(@Request() req: any, @Body() body: { avatar: string }) { return this.usersService.updateAvatar(req.user.userId, body.avatar); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.usersService.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.usersService.remove(id); }
  @Post(':id/assign-role') assignRole(@Param('id') id: string, @Body() body: { roleId: string }) { return this.usersService.assignRole(id, body.roleId); }
  @Post(':id/approve') approve(@Param('id') id: string, @Body() body: { roleId?: string }) { return this.usersService.approve(id, body.roleId); }
  @Post(':id/reject') reject(@Param('id') id: string, @Body() body: { reason?: string }) { return this.usersService.reject(id, body.reason); }
}
