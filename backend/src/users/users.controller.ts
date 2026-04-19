import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';

const ADMIN_ROLES = ['Süper Admin'];

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get() findAll(@Query() query: any) { return this.usersService.findAll(query); }
  @Get('me') getMe(@Request() req: any) { return this.usersService.findOne(req.user.userId); }
  @Roles(...ADMIN_ROLES)
  @Get('pending/list') getPending() { return this.usersService.findPending(); }
  @Get(':id/projects') getUserProjects(@Param('id') id: string) { return this.usersService.findUserProjects(id); }
  @Get(':id/visitors') getVisitors(@Param('id') id: string, @Request() req: any) {
    if (req.user.userId !== id && !ADMIN_ROLES.includes(req.user.roleName)) {
      throw new ForbiddenException('Başka kullanıcının ziyaretçilerini göremezsiniz');
    }
    return this.usersService.getRecentVisitors(id);
  }
  @Get(':id') findOne(@Param('id') id: string, @Request() req: any) {
    if (req.user.userId !== id) {
      this.usersService.recordVisit(id, req.user.userId).catch(() => {});
    }
    return this.usersService.findOne(id);
  }
  @Roles(...ADMIN_ROLES)
  @Post() create(@Body() dto: any) { return this.usersService.create(dto); }
  @Put('me/avatar') updateMyAvatar(@Request() req: any, @Body() body: { avatar: string }) { return this.usersService.updateAvatar(req.user.userId, body.avatar); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    if (req.user.userId !== id && !ADMIN_ROLES.includes(req.user.roleName)) {
      throw new ForbiddenException('Başka kullanıcıyı düzenleme yetkiniz yok');
    }
    return this.usersService.update(id, dto);
  }
  @Roles(...ADMIN_ROLES)
  @Delete(':id') remove(@Param('id') id: string) { return this.usersService.remove(id); }
  @Roles(...ADMIN_ROLES)
  @Post(':id/assign-role') assignRole(@Param('id') id: string, @Body() body: { roleId: string }) { return this.usersService.assignRole(id, body.roleId); }
  @Roles(...ADMIN_ROLES)
  @Post(':id/approve') approve(@Param('id') id: string, @Body() body: { roleId?: string }) { return this.usersService.approve(id, body.roleId); }
  @Roles(...ADMIN_ROLES)
  @Post(':id/reject') reject(@Param('id') id: string, @Body() body: { reason?: string }) { return this.usersService.reject(id, body.reason); }
}
