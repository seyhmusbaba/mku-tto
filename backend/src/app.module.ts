import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { ProjectsModule } from './projects/projects.module';
import { DocumentsModule } from './documents/documents.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SettingsModule } from './settings/settings.module';
import { DynamicFieldsModule } from './dynamic-fields/dynamic-fields.module';
import { PartnersModule } from './partners/partners.module';
import { AiModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ExportModule } from './export/export.module';
import { AuditModule } from './audit/audit.module';
import { CompetitionsModule } from './competitions/competitions.module';
import { EthicsModule } from './ethics/ethics.module';
import { EthicsReview } from './ethics/ethics-review.entity';
import { Competition } from './database/entities/competition.entity';
import { CompetitionSource } from './database/entities/competition-source.entity';
import { AuditLog } from './database/entities/audit-log.entity';
import { ProfileVisit } from './database/entities/profile-visit.entity';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { NotificationsModule } from './notifications/notifications.module';
import { ProjectTypesModule } from './project-types/project-types.module';
import { FacultiesModule } from './faculties/faculties.module';
import { ReportTypesModule } from './report-types/report-types.module';
import { User } from './database/entities/user.entity';
import { Role } from './database/entities/role.entity';
import { Permission } from './database/entities/permission.entity';
import { Project } from './database/entities/project.entity';
import { ProjectMember } from './database/entities/project-member.entity';
import { ProjectDocument } from './database/entities/project-document.entity';
import { ProjectReport } from './database/entities/project-report.entity';
import { SystemSetting } from './database/entities/system-setting.entity';
import { DynamicProjectField } from './database/entities/dynamic-project-field.entity';
import { Notification } from './database/entities/notification.entity';
import { ProjectType } from './database/entities/project-type.entity';
import { Faculty } from './database/entities/faculty.entity';
import { ReportType } from './database/entities/report-type.entity';
import { ProjectPartner } from './database/entities/project-partner.entity';
import { ScopusModule } from './scopus/scopus.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { AdminModule } from './admin/admin.module';
import { SearchModule } from './search/search.module';
import { HealthModule } from './health/health.module';
import { BootstrapService } from './bootstrap.service';

@Module({
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    BootstrapService,
  ],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10_000, limit: 50 },
      { name: 'long', ttl: 60_000, limit: 200 },
    ]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      entities: [
        User, Role, Permission, Project, ProjectMember, ProjectDocument, ProjectReport, ProjectPartner,
        SystemSetting, DynamicProjectField, Notification, ProjectType, Faculty, ReportType, AuditLog, ProfileVisit, Competition, CompetitionSource, EthicsReview,
      ],
      synchronize: true,
      logging: false,
    }),
    TypeOrmModule.forFeature([Permission, Role, Project, User]),
    AuthModule, UsersModule, RolesModule, ProjectsModule,
    DocumentsModule, ReportsModule, DashboardModule, SettingsModule,
    DynamicFieldsModule, NotificationsModule, ProjectTypesModule, FacultiesModule, ReportTypesModule, PartnersModule, AiModule, AnalyticsModule, ExportModule, AuditModule, CompetitionsModule, EthicsModule, ScopusModule, IntegrationsModule, IntelligenceModule, AdminModule, SearchModule, HealthModule,
  ],
})
export class AppModule {}
