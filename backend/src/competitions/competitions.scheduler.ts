import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CompetitionsService } from './competitions.service';

@Injectable()
export class CompetitionsScheduler {
  private readonly logger = new Logger(CompetitionsScheduler.name);

  constructor(private readonly svc: CompetitionsService) {}

  // Her gece yarısı süresi dolmuşları işaretle
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoExpire() {
    const expired = await this.svc.autoExpireCompetitions();
    if (expired > 0) {
      this.logger.log(expired + ' yarişma süresi doldu olarak işaretlendi');
    }
  }

  // Her 6 saatte bir otomatik tara
  @Cron('0 0,6,12,18 * * *')
  async scheduledFetch() {
    this.logger.log('Otomatik yarısma taramasi basladi...');
    try {
      const result = await this.svc.fetchFromSources();
      if (result.added > 0) {
        this.logger.log(result.added + ' yeni duyuru eklendi: ' + (result.sources || []).join(', '));
      } else {
        this.logger.log('Yeni duyuru bulunamadi.');
      }
    } catch (err) {
      this.logger.error('Otomatik tarama hatasi: ' + err);
    }
  }
}
