import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Competition } from '../database/entities/competition.entity';
import { CompetitionSource } from '../database/entities/competition-source.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../database/entities/user.entity';

@Injectable()
export class CompetitionsService {
  constructor(
    @InjectRepository(Competition) private repo: Repository<Competition>,
    @InjectRepository(CompetitionSource) private sourceRepo: Repository<CompetitionSource>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  // ── KAYNAK YÖNETİMİ ───────────────────────────────────────────
  async getSources() {
    return this.sourceRepo.find({ order: { createdAt: 'ASC' } });
  }

  async createSource(dto: Partial<CompetitionSource>) {
    const src = this.sourceRepo.create(dto);
    return this.sourceRepo.save(src);
  }

  async updateSource(id: string, dto: Partial<CompetitionSource>) {
    await this.sourceRepo.update(id, dto);
    return this.sourceRepo.findOne({ where: { id } });
  }

  async deleteSource(id: string) {
    await this.sourceRepo.delete(id);
    return { deleted: true };
  }

  // ── TARİH PARSE ───────────────────────────────────────────────
  private parseDeadlineDate(str: string): Date | null {
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(str);
    const dmy = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
    const TR: Record<string, number> = {
      ocak: 0, subat: 1, mart: 2, nisan: 3, mayis: 4, haziran: 5,
      temmuz: 6, agustos: 7, eylul: 8, ekim: 9, kasim: 10, aralik: 11,
      'şubat': 1, 'mayıs': 4, 'ağustos': 7, 'eylül': 8, 'kasım': 10, 'aralık': 11,
    };
    const parts = str.toLowerCase().replace(/[,]/g, '').split(/\s+/);
    if (parts.length >= 2) {
      const day = parseInt(parts[0]);
      const month = TR[parts[1]];
      const year = parts.length >= 3 ? parseInt(parts[2]) : new Date().getFullYear();
      if (!isNaN(day) && month !== undefined && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  // ── OTOMATİK EXPIRE ───────────────────────────────────────────
  async autoExpireCompetitions(): Promise<number> {
    const all = await this.repo.find({ where: { isActive: true, status: 'active' } as any });
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let expired = 0;
    for (const comp of all) {
      if (!comp.deadline) continue;
      const d = this.parseDeadlineDate(comp.deadline);
      if (d && d < now) {
        await this.repo.update(comp.id, { status: 'expired' });
        expired++;
      }
    }
    return expired;
  }

  // ── LİSTELEME ─────────────────────────────────────────────────
  async findAll(q: any) {
    const { source, category, status, search, page = 1, limit = 12 } = q;

    // Süresi dolmuşları güncelle
    await this.autoExpireCompetitions();

    // 30 günden eski sona erenleri gizle
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const qb = this.repo.createQueryBuilder('c').where('c.isActive = true');

    if (source) qb.andWhere('c.source = :source', { source });
    if (category) qb.andWhere('c.category = :category', { category });

    if (status) {
      qb.andWhere('c.status = :status', { status });
    } else {
      // Varsayılan: aktif + yakında + son 30 günde sona erenler
      qb.andWhere(
        "(c.status IN ('active','upcoming') OR (c.status = 'expired' AND c.updatedAt >= :cutoff))",
        { cutoff: thirtyDaysAgo },
      );
    }

    if (search) {
      qb.andWhere('(c.title ILIKE :s OR c.description ILIKE :s)', { s: '%' + search + '%' });
    }

    // Sıralama: aktifler önce, yakında sonra, sona erenler en sona
    qb.orderBy("CASE WHEN c.status = 'active' THEN 0 WHEN c.status = 'upcoming' THEN 1 ELSE 2 END", 'ASC')
      .addOrderBy('c.createdAt', 'DESC');

    const [data, total] = await qb
      .skip((+page - 1) * +limit)
      .take(+limit)
      .getManyAndCount();

    return { data, total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) };
  }

  async findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: Partial<Competition>) {
    const comp = this.repo.create({
      ...dto,
      isManual: true,
      isActive: true,
      status: dto.status || 'active',
    });
    const saved = await this.repo.save(comp);
    await this.sendNotifications(saved);
    return saved;
  }

  async update(id: string, dto: Partial<Competition>) {
    await this.repo.update(id, dto);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: string) {
    await this.repo.update(id, { isActive: false });
    return { deleted: true };
  }

  // ── KAYNAK TARAMA ─────────────────────────────────────────────
  async fetchFromSources() {
    const sources = await this.sourceRepo.find({ where: { isActive: true } });

    if (!sources.length) {
      return {
        added: 0,
        message: 'Henüz kaynak eklenmemiş. Kaynaklar sekmesinden RSS kaynağı ekleyin.',
      };
    }

    let totalAdded = 0;
    const usedSources: string[] = [];

    for (const src of sources) {
      try {
        let added = 0;
        if (src.type === 'rss') {
          added = await this.fetchRSS(src);
        }
        if (added > 0) {
          totalAdded += added;
          usedSources.push(src.name);
        }
        await this.sourceRepo.update(src.id, {
          lastFetchedAt: new Date(),
          totalFetched: (src.totalFetched || 0) + added,
        });
      } catch (_) {}
    }

    return {
      added: totalAdded,
      sources: usedSources,
      message:
        totalAdded > 0
          ? totalAdded + ' yeni duyuru eklendi'
          : 'Yeni duyuru bulunamadı.',
    };
  }

  async testSource(url: string): Promise<{ ok: boolean; count: number; preview: string[] }> {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { ok: false, count: 0, preview: [] };
      const text = await res.text();
      const items = this.parseRSS(text);
      return {
        ok: true,
        count: items.length,
        preview: items.slice(0, 3).map((i) => i.title),
      };
    } catch (e: any) {
      return { ok: false, count: 0, preview: [e.message || 'Bağlantı hatası'] };
    }
  }

  private async fetchRSS(src: CompetitionSource): Promise<number> {
    const res = await fetch(src.url, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return 0;
    const text = await res.text();
    const items = this.parseRSS(text);
    let added = 0;

    for (const item of items.slice(0, 20)) {
      const raw = item.link || item.title;
      const externalId = src.id + '_' + Buffer.from(raw).toString('base64').slice(0, 40);
      const exists = await this.repo.findOne({ where: { externalId } });
      if (exists) continue;

      const comp = this.repo.create({
        title: item.title,
        description: item.description
          ? item.description.replace(/<[^>]*>/g, '').trim().slice(0, 600)
          : null,
        source: src.name.toLowerCase().replace(/\s+/g, '_').slice(0, 30),
        sourceUrl: item.link,
        applyUrl: item.link,
        deadline: item.pubDate
          ? new Date(item.pubDate).toLocaleDateString('tr-TR')
          : null,
        category: src.defaultCategory || 'araştırma',
        status: 'active',
        isManual: false,
        isActive: true,
        externalId,
      });
      const saved = await this.repo.save(comp);
      await this.sendNotifications(saved);
      added++;
    }
    return added;
  }

  private parseRSS(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
    const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
    const matches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
    for (const m of matches) {
      const block = m[1];
      const getTag = (tag: string): string => {
        const pattern = '<' + tag + '[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/' + tag + '>';
        const r = block.match(new RegExp(pattern, 'i'));
        return r ? r[1].trim() : '';
      };
      const title = getTag('title');
      const link = getTag('link') || getTag('guid');
      const description = getTag('description') || getTag('summary');
      const pubDate = getTag('pubDate') || getTag('dc:date');
      if (title) items.push({ title, link, description, pubDate });
    }
    return items;
  }

  private async sendNotifications(comp: Competition): Promise<void> {
    try {
      const users = await this.userRepo.find({ where: { isActive: true as any } });
      for (const u of users) {
        try {
          await this.notificationsService.create({
            userId: u.id,
            title: '🏆 Yeni Yarışma/Destek Duyurusu',
            message: comp.title,
            type: 'info',
            link: '/competitions',
          });
        } catch (_) {}
      }
    } catch (_) {}
  }

  async getStats() {
    const total = await this.repo.count({ where: { isActive: true } });
    const active = await this.repo.count({ where: { isActive: true, status: 'active' } as any });
    const bySrc = await this.repo
      .createQueryBuilder('c')
      .select('c.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .where('c.isActive = true')
      .groupBy('c.source')
      .getRawMany();
    return { total, active, bySources: bySrc };
  }
}
