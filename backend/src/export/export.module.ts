import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../database/entities/project.entity';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  controllers: [ExportController],
})
export class ExportModule {}
