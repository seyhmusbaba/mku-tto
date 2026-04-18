import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScopusService } from './scopus.service';
import { ScopusController } from './scopus.controller';
import { User } from '../database/entities/user.entity';
import { Project } from '../database/entities/project.entity';
import { ProjectMember } from '../database/entities/project-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Project, ProjectMember])],
  providers: [ScopusService],
  controllers: [ScopusController],
  exports: [ScopusService],
})
export class ScopusModule {}
