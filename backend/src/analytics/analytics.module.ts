import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { ProjectReport } from '../database/entities/project-report.entity';
import { SystemSetting } from '../database/entities/system-setting.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { BibliometricsService } from './bibliometrics.service';
import { InstitutionalService } from './institutional.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ProjectMember } from '../database/entities/project-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, User, ProjectReport, SystemSetting, ProjectMember]),
    IntegrationsModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, BibliometricsService, InstitutionalService],
  exports: [AnalyticsService, BibliometricsService, InstitutionalService],
})
export class AnalyticsModule {}
