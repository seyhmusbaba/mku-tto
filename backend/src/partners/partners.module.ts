import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectPartner } from '../database/entities/project-partner.entity';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { PartnersPortfolioController } from './partners-portfolio.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectPartner])],
  providers: [PartnersService],
  controllers: [PartnersController, PartnersPortfolioController],
  exports: [PartnersService],
})
export class PartnersModule {}
