import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { Project } from '../database/entities/project.entity';
import { Publication } from '../database/entities/publication.entity';
import { ProjectPartner } from '../database/entities/project-partner.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { SystemSetting } from '../database/entities/system-setting.entity';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Project, Publication, ProjectPartner, ProjectMember, SystemSetting])],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
