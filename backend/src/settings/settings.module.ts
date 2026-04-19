import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SystemSetting } from '../database/entities/system-setting.entity';
import { User } from '../database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting, User])],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
