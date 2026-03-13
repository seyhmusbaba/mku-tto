import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectType } from '../database/entities/project-type.entity';
import { ProjectTypesService } from './project-types.service';
import { ProjectTypesController } from './project-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectType])],
  providers: [ProjectTypesService],
  controllers: [ProjectTypesController],
  exports: [ProjectTypesService],
})
export class ProjectTypesModule {}
