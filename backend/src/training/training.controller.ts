import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TrainingService } from './training.service';

@SkipThrottle()
@Controller('training')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private svc: TrainingService) {}

  // ── Programs ──────────────────────────────────────────────
  @Get('programs')
  listPrograms(@Query() q: any) { return this.svc.listPrograms(q); }

  @Get('programs/:id')
  getProgram(@Param('id') id: string) { return this.svc.getProgram(id); }

  @Post('programs')
  createProgram(@Body() dto: any) { return this.svc.createProgram(dto); }

  @Put('programs/:id')
  updateProgram(@Param('id') id: string, @Body() dto: any) { return this.svc.updateProgram(id, dto); }

  @Delete('programs/:id')
  deleteProgram(@Param('id') id: string) { return this.svc.deleteProgram(id); }

  // ── Registrations ─────────────────────────────────────────
  @Get('programs/:id/registrations')
  listRegs(@Param('id') id: string) { return this.svc.listRegistrations(id); }

  @Get('my-registrations')
  myRegs(@Req() req: any) { return this.svc.listMyRegistrations(req.user.userId); }

  @Post('programs/:id/register')
  register(@Param('id') id: string, @Req() req: any) {
    return this.svc.register(req.user.userId, id);
  }

  @Delete('programs/:id/register')
  unregister(@Param('id') id: string, @Req() req: any) {
    return this.svc.unregister(req.user.userId, id);
  }

  @Post('registrations/:id/attendance')
  attendance(@Param('id') id: string, @Body() body: { attended: boolean }) {
    return this.svc.markAttendance(id, !!body.attended);
  }

  @Post('programs/:id/feedback')
  feedback(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { rating: number; feedback?: string },
  ) {
    return this.svc.submitFeedback(req.user.userId, id, body.rating, body.feedback);
  }

  @Post('registrations/:id/certificate')
  certificate(@Param('id') id: string) { return this.svc.issueCertificate(id); }
}
