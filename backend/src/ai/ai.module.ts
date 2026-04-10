import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { AiController } from './ai.controller';
import { YoksisService } from './yoksis.service';
import { AiComplianceService } from './ai-compliance.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AiController],
  providers: [YoksisService, AiComplianceService],
  exports: [YoksisService, AiComplianceService],
})
export class AiModule {}
