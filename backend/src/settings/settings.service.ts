import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../database/entities/system-setting.entity';

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(SystemSetting) private settingRepo: Repository<SystemSetting>) {}

  async getAll() {
    const settings = await this.settingRepo.find();
    return settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
  }

  async update(data: Record<string, string>) {
    for (const [key, value] of Object.entries(data)) {
      let setting = await this.settingRepo.findOne({ where: { key } });
      if (setting) { setting.value = value; await this.settingRepo.save(setting); }
      else await this.settingRepo.save(this.settingRepo.create({ key, value }));
    }
    return this.getAll();
  }
}
