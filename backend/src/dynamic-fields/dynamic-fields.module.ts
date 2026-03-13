import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DynamicFieldsController } from './dynamic-fields.controller';
import { DynamicFieldsService } from './dynamic-fields.service';
import { DynamicProjectField } from '../database/entities/dynamic-project-field.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DynamicProjectField])],
  controllers: [DynamicFieldsController],
  providers: [DynamicFieldsService],
})
export class DynamicFieldsModule {}
