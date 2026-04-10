import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EthicsReview } from './ethics-review.entity';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { EthicsController } from './ethics.controller';
import { EthicsService } from './ethics.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([EthicsReview, Project, User]), NotificationsModule],
  controllers: [EthicsController],
  providers: [EthicsService],
  exports: [EthicsService],
})
export class EthicsModule {}
