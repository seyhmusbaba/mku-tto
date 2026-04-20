import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { IntelligenceController } from './intelligence.controller';
import { IntelligenceService } from './intelligence.service';
import { IntegrationsModule } from '../integrations/integrations.module';

/**
 * Project Intelligence — proje oluşturma/düzenleme ekranındaki karar
 * destek paneli için 10 widget endpoint'i barındırır. Integrations modülünün
 * altındaki servislerin üstünde orchestrator rolü oynar.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Project, User]),
    IntegrationsModule,
  ],
  controllers: [IntelligenceController],
  providers: [IntelligenceService],
})
export class IntelligenceModule {}
