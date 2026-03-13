import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Faculty } from '../database/entities/faculty.entity';
import { FacultiesService } from './faculties.service';
import { FacultiesController } from './faculties.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Faculty])],
  providers: [FacultiesService],
  controllers: [FacultiesController],
  exports: [FacultiesService],
})
export class FacultiesModule {}
