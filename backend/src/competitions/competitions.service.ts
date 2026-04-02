import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Competition } from '../database/entities/competition.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../database/entities/user.entity';

const SOURCES = [
  {
    key: 'tubitak',
    name: 'TÜBİTAK',
    rssUrl: 'https://www.tubitak.gov.tr/tr/duyurular/icerik-haber-rss',
    color: '#1d4ed8',
  },
  {
    key: 'horizon',
    name: 'Horizon Europe',
    rssUrl: 'https://ec.europa.eu/info/funding-tenders/opportunities/data/topicDetails.json',
    color: '#003399',
  },
];

@Injectable()
export class CompetitionsService {
  constructor(
    @InjectRepository(Competition) private repo: Repository<Competition>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(q: {
    source?: string;
    category?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { source, category, status, search, page = 1, limit = 20 } = q;
    const qb = this.repo.createQueryBuilder('c')
      .where('c.isActive = :active', { active: true });

    if (source) qb.andWhere('c.source = :source', { source });
    if (category) qb.andWhere('c.category = :category', { category });
    if (status) qb.andWhere('c.status = :status', { status });
    if (search) qb.andWhere('(c.title ILIKE :s OR c.description ILIKE :s)', { s: `%${search}%` });

    qb.orderBy('c.createdAt', 'DESC');

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
    // Tüm kullanıcılara sistem bildirimi gönder
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

  async fetchFromSources() {
    const results: { added: number; sources: string[] } = { added: 0, sources: [] };

    // TÜBİTAK RSS
    try {
      const added = await this.fetchTubitakRSS();
      if (added > 0) { results.added += added; results.sources.push('TÜBİTAK'); }
    } catch {}

    // Horizon Europe (açık API)
    try {
      const added = await this.fetchHorizonEurope();
      if (added > 0) { results.added += added; results.sources.push('Horizon Europe'); }
    } catch {}

    return results;
  }

  private async fetchTubitakRSS(): Promise<number> {
    const rssUrls = [
      'https://www.tubitak.gov.tr/tr/duyurular/icerik-haber-rss',
      'https://www.tubitak.gov.tr/tr/destekler/akademik/ulusal-destek-programlari/icerik-1001',
    ];

    let added = 0;
    for (const url of rssUrls) {
      try {
        const res = await fetch(url, {
          headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const text = await res.text();
        const items = this.parseRSS(text);

        for (const item of items.slice(0, 10)) {
          const externalId = 'tubitak_' + Buffer.from(item.link || item.title).toString('base64').slice(0, 32);
          const exists = await this.repo.findOne({ where: { externalId } });
          if (exists) continue;

          const comp = this.repo.create({
            title: item.title,
            description: item.description?.replace(/<[^>]*>/g, '').slice(0, 500),
            source: 'tubitak',
            sourceUrl: item.link,
            applyUrl: item.link,
            category: 'araştırma',
            status: 'active',
            isManual: false,
            isActive: true,
            externalId,
          });
          const saved = await this.repo.save(comp);
          await this.sendNotifications(saved);
          added++;
        }
      } catch {}
    }
    return added;
  }

  private async fetchHorizonEurope(): Promise<number> {
    let added = 0;
    try {
      const res = await fetch(
        'https://ec.europa.eu/info/funding-tenders/opportunities/data/topicDetails.json?callStatus=open&programmePeriod=2021-2027&sortBy=startDate&order=desc&pageSize=10',
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return 0;
      const data = await res.json();
      const topics = data?.fundingData?.GrantTenderObj || [];

      for (const topic of topics.slice(0, 5)) {
        const externalId = 'horizon_' + (topic.identifier || topic.id || '').slice(0, 32);
        const exists = await this.repo.findOne({ where: { externalId } });
        if (exists) continue;

        const comp = this.repo.create({
          title: topic.title || topic.titleEn || 'Horizon Europe Çağrısı',
          description: (topic.description || topic.objective || '').replace(/<[^>]*>/g, '').slice(0, 500),
          source: 'horizon',
          sourceUrl: `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${topic.identifier}`,
          applyUrl: `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${topic.identifier}`,
          deadline: topic.deadlineDate ? new Date(topic.deadlineDate).toLocaleDateString('tr-TR') : null,
          category: 'uluslararası',
          status: 'active',
          isManual: false,
          isActive: true,
          externalId,
        });
        const saved = await this.repo.save(comp);
        await this.sendNotifications(saved);
        added++;
      }
    } catch {}
    return added;
  }

  private parseRSS(xml: string): Array<{ title: string; link: string; description: string }> {
    const items: Array<{ title: string; link: string; description: string }> = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const content = match[1];
      const title = content.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/)?.[1] || '';
      const link = content.match(/<link[^>]*>(.*?)<\/link>|<link>(.*?)<\/link>/)?.[1] || '';
      const description = content.match(/<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/)?.[1] || '';
      if (title) items.push({ title: title.trim(), link: link.trim(), description: description.trim() });
    }
    return items;
  }

  private async sendNotifications(comp: Competition) {
    try {
      // Aktif tüm kullanıcılara sistem içi bildirim
      const users = await this.userRepo.find({ where: { isActive: true as any } });
      const source = this.getSourceLabel(comp.source);
      await Promise.all(users.map(u =>
        this.notificationsService.create({
          userId: u.id,
          title: '🏆 Yeni Yarışma/Destek Duyurusu',
          message: `${source}: ${comp.title}`,
          type: 'info',
          link: '/competitions',
        }).catch(() => {})
      ));
    } catch {}
  }

  private getSourceLabel(source: string): string {
    const labels: Record<string, string> = {
      tubitak: 'TÜBİTAK', horizon: 'Horizon Europe',
      kosgeb: 'KOSGEB', kalkinma: 'Kalkınma Ajansı', diger: 'Diğer',
    };
    return labels[source] || source;
  }

  async getStats() {
    const total = await this.repo.count({ where: { isActive: true } });
    const active = await this.repo.count({ where: { isActive: true, status: 'active' } as any });
    const bySrc = await this.repo.createQueryBuilder('c')
      .select('c.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .where('c.isActive = true')
      .groupBy('c.source')
      .getRawMany();
    return { total, active, bySources: bySrc };
  }
}
