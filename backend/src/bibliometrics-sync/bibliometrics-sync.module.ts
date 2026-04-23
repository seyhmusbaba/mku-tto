import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ScopusModule } from '../scopus/scopus.module';
import { BibliometricsSyncService } from './bibliometrics-sync.service';
import { BibliometricsSyncController } from './bibliometrics-sync.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    IntegrationsModule,
    ScopusModule,
  ],
  providers: [BibliometricsSyncService],
  controllers: [BibliometricsSyncController],
  exports: [BibliometricsSyncService],
})
export class BibliometricsSyncModule {}
