import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project, User, ProjectMember])],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
