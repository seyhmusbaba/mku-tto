import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainingProgram, TrainingRegistration } from '../database/entities/training.entities';
import { TrainingService } from './training.service';
import { TrainingController } from './training.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TrainingProgram, TrainingRegistration])],
  providers: [TrainingService],
  controllers: [TrainingController],
  exports: [TrainingService],
})
export class TrainingModule {}
