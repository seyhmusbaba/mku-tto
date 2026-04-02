import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Competition } from '../database/entities/competition.entity';
import { User } from '../database/entities/user.entity';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Competition, User]), NotificationsModule],
  controllers: [CompetitionsController],
  providers: [CompetitionsService],
  exports: [CompetitionsService],
})
export class CompetitionsModule {}
