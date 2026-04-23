import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { Project } from '../database/entities/project.entity';
import { Competition } from '../database/entities/competition.entity';
import { SystemSetting } from '../database/entities/system-setting.entity';
import { AiController } from './ai.controller';
import { YoksisService } from './yoksis.service';
import { AiComplianceService } from './ai-compliance.service';
import { AiAssistantService } from './ai-assistant.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Project, Competition, SystemSetting])],
  controllers: [AiController],
  providers: [YoksisService, AiComplianceService, AiAssistantService],
  exports: [YoksisService, AiComplianceService, AiAssistantService],
})
export class AiModule {}
