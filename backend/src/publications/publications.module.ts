import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Publication } from '../database/entities/publication.entity';
import { UserPublicationsService } from './publications.service';
import { UserPublicationsController } from './publications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Publication])],
  providers: [UserPublicationsService],
  controllers: [UserPublicationsController],
  exports: [UserPublicationsService],
})
export class UserPublicationsModule {}
