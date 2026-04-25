import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PublicService } from './public.service';

/**
 * AVESİS tarzı vitrin portalı için kamuya açık uç noktalar.
 * Authentication yok - anonim ziyaretçiler erişebilir.
 */
@SkipThrottle()
@Controller('public')
export class PublicController {
  constructor(private svc: PublicService) {}

  @Get('institution')
  institution() { return this.svc.getInstitution(); }

  @Get('stats')
  stats() { return this.svc.getStats(); }

  @Get('faculties')
  faculties() { return this.svc.getFaculties(); }

  @Get('recent')
  recent() { return this.svc.getRecent(); }

  @Get('researchers')
  researchers(@Query() q: any) { return this.svc.listResearchers(q); }

  @Get('researchers/:slug')
  profile(@Param('slug') slug: string) { return this.svc.getProfile(slug); }

  @Get('researchers/:slug/publications')
  pubs(@Param('slug') slug: string) { return this.svc.getProfilePublications(slug); }

  @Get('researchers/:slug/projects')
  projects(@Param('slug') slug: string) { return this.svc.getProfileProjects(slug); }

  @Get('researchers/:slug/collaborations')
  collaborations(@Param('slug') slug: string) { return this.svc.getProfileCollaborations(slug); }

  // Admin bootstrap - tüm mevcut kullanıcılar için slug oluştur
  @Post('backfill-slugs')
  backfill() { return this.svc.backfillSlugs(); }
}
