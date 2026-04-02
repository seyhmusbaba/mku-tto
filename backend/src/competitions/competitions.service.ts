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

  // ── YARIŞMALAR ────────────────────────────────────────────────
  async findAll(q: any) {
    const { source, category, status, search, page = 1, limit = 12 } = q;
    const qb = this.repo.createQueryBuilder('c').where('c.isActive = true');
    if (source) qb.andWhere('c.source = :source', { source });
    if (category) qb.andWhere('c.category = :category', { category });
    if (status) qb.andWhere('c.status = :status', { status });
    if (search) qb.andWhere('(c.title ILIKE :s OR c.description ILIKE :s)', { s: `%${search}%` });
    qb.orderBy('c.createdAt', 'DESC');
    const [data, total] = await qb.skip((+page-1)*+limit).take(+limit).getManyAndCount();
    return { data, total, page: +page, limit: +limit, totalPages: Math.ceil(total/+limit) };
  }

  async findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: Partial<Competition>) {
    const comp = this.repo.create({ ...dto, isManual: true, isActive: true, status: dto.status || 'active' });
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
      return { added: 0, message: 'Henüz kaynak eklenmemiş. Sistem Ayarları → Kaynaklar bölümünden kaynak ekleyin.' };
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
          await this.sourceRepo.update(src.id, {
            lastFetchedAt: new Date(),
            totalFetched: (src.totalFetched || 0) + added,
          });
        } else {
          // Son tarama zamanını güncelle
          await this.sourceRepo.update(src.id, { lastFetchedAt: new Date() });
        }
      } catch {}
    }

    return {
      added: totalAdded,
      sources: usedSources,
      message: totalAdded > 0
        ? `${totalAdded} yeni duyuru eklendi`
        : 'Yeni duyuru bulunamadı. RSS kaynaklarınızın güncel ve erişilebilir olduğunu kontrol edin.',
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
        preview: items.slice(0, 3).map(i => i.title),
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
      const externalId = src.id + '_' + Buffer.from(item.link || item.title).toString('base64').slice(0, 40);
      const exists = await this.repo.findOne({ where: { externalId } });
      if (exists) continue;

      const comp = this.repo.create({
        title: item.title,
        description: item.description?.replace(/<[^>]*>/g, '').trim().slice(0, 600) || null,
        source: src.name.toLowerCase().replace(/\s+/g, '_').slice(0, 30),
        sourceUrl: item.link,
        applyUrl: item.link,
        deadline: item.pubDate ? new Date(item.pubDate).toLocaleDateString('tr-TR') : null,
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

  private parseRSS(xml: string) {
    const items: any[] = [];
    const matches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
    for (const m of matches) {
      const block = m[1];
      const get = (tag: string) => {
        const r = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
        return r?.[1]?.trim() || '';
      };
      const title = get('title');
      const link = get('link') || get('guid');
      const description = get('description') || get('summary');
      const pubDate = get('pubDate') || get('dc:date');
      if (title) items.push({ title, link, description, pubDate });
    }
    return items;
  }

  private async sendNotifications(comp: Competition) {
    try {
      const users = await this.userRepo.find({ where: { isActive: true as any } });
      await Promise.all(users.map(u =>
        this.notificationsService.create({
          userId: u.id,
          title: '🏆 Yeni Yarışma/Destek Duyurusu',
          message: `${comp.title}`,
          type: 'info',
          link: '/competitions',
        }).catch(() => {})
      ));
    } catch {}
  }

  async getStats() {
    const total = await this.repo.count({ where: { isActive: true } });
    const active = await this.repo.count({ where: { isActive: true, status: 'active' } as any });
    const bySrc = await this.repo.createQueryBuilder('c')
      .select('c.source', 'source').addSelect('COUNT(*)', 'count')
      .where('c.isActive = true').groupBy('c.source').getRawMany();
    return { total, active, bySources: bySrc };
  }
}
