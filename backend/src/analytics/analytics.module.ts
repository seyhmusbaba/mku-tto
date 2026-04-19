import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { ProjectReport } from '../database/entities/project-report.entity';
import { SystemSetting } from '../database/entities/system-setting.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { BibliometricsService } from './bibliometrics.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, User, ProjectReport, SystemSetting]),
    IntegrationsModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, BibliometricsService],
  exports: [AnalyticsService, BibliometricsService],
})
export class AnalyticsModule {}
