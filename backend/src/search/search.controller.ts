import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService } from './search.service';

@SkipThrottle()
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get()
  async search(@Query('q') q: string, @Query('limit') limit?: string) {
    if (!q || q.trim().length < 2) {
      throw new BadRequestException('En az 2 karakterlik sorgu gerekli');
    }
    return this.svc.globalSearch(q, limit ? +limit : 5);
  }
}
