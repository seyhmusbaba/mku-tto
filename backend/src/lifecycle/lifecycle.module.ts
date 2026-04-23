import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMilestone, ProjectDeliverable, ProjectRisk } from '../database/entities/project-lifecycle.entities';
import { LifecycleService } from './lifecycle.service';
import { LifecycleController } from './lifecycle.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectMilestone, ProjectDeliverable, ProjectRisk])],
  providers: [LifecycleService],
  controllers: [LifecycleController],
  exports: [LifecycleService],
})
export class LifecycleModule {}
