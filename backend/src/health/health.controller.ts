import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';

/**
 * /api/health - uygulamanın canlılık kontrolü.
 * Auth-gerektirmez, sadece DB bağlantısını ve kritik repo'ları doğrular.
 * Railway veya harici monitoring ile kullanılabilir.
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  @Get()
  async health() {
    const start = Date.now();
    const checks: Record<string, any> = {};

    // DB - basit count sorgusu
    try {
      const [projectCount, userCount] = await Promise.all([
        this.projectRepo.count(),
        this.userRepo.count(),
      ]);
      checks.database = { ok: true, projectCount, userCount };
    } catch (e: any) {
      checks.database = { ok: false, error: e.message };
    }

    // Env - kritik değişkenler
    checks.env = {
      jwtSecret: !!process.env.JWT_SECRET,
      databaseUrl: !!process.env.DATABASE_URL,
      frontendUrl: !!process.env.FRONTEND_URL || process.env.NODE_ENV !== 'production',
      scopusKey: !!process.env.SCOPUS_API_KEY,
      wosKey: !!process.env.WOS_API_KEY,
      epoKey: !!(process.env.EPO_CONSUMER_KEY && process.env.EPO_CONSUMER_SECRET),
      anthropicKey: !!process.env.ANTHROPIC_API_KEY,
    };

    const allOk = Object.values(checks).every((c: any) =>
      typeof c === 'object' && 'ok' in c ? c.ok : true
    );

    return {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      latencyMs: Date.now() - start,
      checks,
    };
  }
}
