import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportType } from '../database/entities/report-type.entity';
import { ReportTypesService } from './report-types.service';
import { ReportTypesController } from './report-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReportType])],
  providers: [ReportTypesService],
  controllers: [ReportTypesController],
  exports: [ReportTypesService],
})
export class ReportTypesModule {}
