import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Competition } from '../database/entities/competition.entity';
import { CompetitionSource } from '../database/entities/competition-source.entity';
import { User } from '../database/entities/user.entity';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Competition, CompetitionSource, User]), NotificationsModule],
  controllers: [CompetitionsController],
  providers: [CompetitionsService],
  exports: [CompetitionsService],
})
export class CompetitionsModule {}
