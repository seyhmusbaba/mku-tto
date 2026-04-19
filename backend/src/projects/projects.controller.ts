import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ProjectsService } from './projects.service';

const CAN_CREATE = ['Süper Admin', 'Akademisyen', 'Rektör', 'Dekan', 'Bölüm Başkanı'];

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get('budget-estimate') budgetEstimate(@Query() q: any) { return this.projectsService.estimateBudget(q); }
  @Get('budget-stats') budgetStats(@Query() q: any) { return this.projectsService.getBudgetStats(q.type, q.faculty); }
  @Get('similar') similarByTitle(@Query() q: any) { return this.projectsService.findSimilarByTitle(q.title, q.description, q.excludeId); }
  @Get() findAll(@Query() query: any, @Request() req: any) { return this.projectsService.findAll(query, req.user); }
  @Get(':id/similar') similar(@Param('id') id: string) { return this.projectsService.findSimilar(id); }

  @Get(':id/qr')
  async qrCode(@Param('id') id: string, @Res() res: any) {
    try {
      const QRCode = require('qrcode');
      const frontendUrl = process.env.FRONTEND_URL
        || (process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000');
      if (!frontendUrl) {
        return res.status(500).json({ error: 'FRONTEND_URL tanımlı değil' });
      }
      const url = `${frontendUrl}/projects/${id}`;
      const buffer = await QRCode.toBuffer(url, { width: 300, margin: 2 });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: 'QR oluşturulamadı' });
    }
  }

  @Get(':id') findOne(@Param('id') id: string) { return this.projectsService.findOne(id); }
  @Roles(...CAN_CREATE)
  @Post() create(@Body() dto: any, @Request() req: any) { return this.projectsService.create(dto, req.user.userId); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any, @Request() req: any) { return this.projectsService.update(id, dto, req.user); }
  @Delete(':id') remove(@Param('id') id: string) { return this.projectsService.remove(id); }
  @Post(':id/members') addMember(@Param('id') id: string, @Body() dto: any) { return this.projectsService.addMember(id, dto); }
  @Put(':id/members/:userId') updateMember(@Param('id') id: string, @Param('userId') userId: string, @Body() dto: any) { return this.projectsService.updateMember(id, userId, dto); }
  @Delete(':id/members/:userId') removeMember(@Param('id') id: string, @Param('userId') userId: string) { return this.projectsService.removeMember(id, userId); }
}
