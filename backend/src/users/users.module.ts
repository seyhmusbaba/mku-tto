import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { ProfileVisit } from '../database/entities/profile-visit.entity';
import { Role } from '../database/entities/role.entity';
import { Project } from '../database/entities/project.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, ProfileVisit, Role, Project, ProjectMember])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
