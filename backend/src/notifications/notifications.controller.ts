import { Controller, Get, Post, Patch, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get() getAll(@Request() req: any) { return this.svc.findForUser(req.user.userId); }
  @Get('unread-count') count(@Request() req: any) { return this.svc.unreadCount(req.user.userId).then(c => ({ count: c })); }
  @Patch(':id/read') read(@Param('id') id: string, @Request() req: any) { return this.svc.markRead(id, req.user.userId); }
  @Post('read-all') readAll(@Request() req: any) { return this.svc.markAllRead(req.user.userId); }
  @Delete(':id') del(@Param('id') id: string, @Request() req: any) { return this.svc.deleteOne(id, req.user.userId); }
}
