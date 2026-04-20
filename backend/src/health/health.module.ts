import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { HealthController } from './health.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project, User])],
  controllers: [HealthController],
})
export class HealthModule {}
