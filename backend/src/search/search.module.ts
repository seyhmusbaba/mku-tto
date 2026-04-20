import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { ProjectDocument } from '../database/entities/project-document.entity';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, User, ProjectDocument])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
