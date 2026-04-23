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
  async search(
    @Query('q') q: string,
    @Query('scope') scope?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('faculty') faculty?: string,
    @Query('yearFrom') yearFrom?: string,
    @Query('yearTo') yearTo?: string,
    @Query('limit') limit?: string,
  ) {
    if (!q || q.trim().length < 2) {
      throw new BadRequestException('En az 2 karakterlik sorgu gerekli');
    }
    return this.svc.globalSearch(q, {
      scope,
      type,
      status,
      faculty,
      yearFrom: yearFrom ? +yearFrom : undefined,
      yearTo: yearTo ? +yearTo : undefined,
      limit: limit ? +limit : 8,
    });
  }

  @Get('suggest')
  async suggest(@Query('q') q: string, @Query('limit') limit?: string) {
    return { suggestions: await this.svc.suggest(q || '', limit ? +limit : 5) };
  }
}
