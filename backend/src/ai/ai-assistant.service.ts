import { Injectable, ServiceUnavailableException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../database/entities/project.entity';
import { Competition } from '../database/entities/competition.entity';
import { User } from '../database/entities/user.entity';
import { SystemSetting } from '../database/entities/system-setting.entity';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantRequest {
  messages: AssistantMessage[];
  context?: 'general' | 'project' | 'competitions' | 'publications' | 'training';
  maxTokens?: number;
}

/**
 * Tek-sayfa TTO asistanı — gerçek veri bağlamı ile Claude API'ye proxy.
 *
 * Frontend'de tek bir /assistant sayfası açılır; bu servis arkada ilgili
 * kurumsal bağlamı otomatik enjekte eder (proje listesi, aktif rakipler,
 * kullanıcı profili vs.) ki model "MKÜ'de şu an hangi projeler var?"
 * sorusuna genel bilgi yerine gerçek veri ile cevap versin.
 */
@Injectable()
export class AiAssistantService {
  constructor(
    @InjectRepository(Project)       private projectRepo: Repository<Project>,
    @InjectRepository(Competition)   private compRepo: Repository<Competition>,
    @InjectRepository(User)          private userRepo: Repository<User>,
    @InjectRepository(SystemSetting) private settingRepo: Repository<SystemSetting>,
  ) {}

  async chat(userId: string, body: AssistantRequest) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('ANTHROPIC_API_KEY tanımlı değil.');

    const context = body.context || 'general';
    const systemPrompt = await this.buildSystemPrompt(context, userId);

    // Basit istemci-taraf kontrolü: sohbet boş değilse ve son mesaj kullanıcıdansa gönder
    const messages = (body.messages || []).filter(m => m.content && m.content.trim());
    if (messages.length === 0) {
      throw new HttpException('Mesaj boş olamaz.', HttpStatus.BAD_REQUEST);
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: body.maxTokens || 1200,
          system: systemPrompt,
          messages,
        }),
        signal: AbortSignal.timeout(40000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new HttpException(
          'Anthropic API hatası: ' + ((err as any)?.error?.message || res.status),
          HttpStatus.BAD_GATEWAY,
        );
      }
      const data = await res.json();
      const text = data?.content?.find((b: any) => b.type === 'text')?.text || '';
      return { text, context };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e?.message || 'Bağlantı hatası', HttpStatus.BAD_GATEWAY);
    }
  }

  private async buildSystemPrompt(context: string, userId: string): Promise<string> {
    const siteSetting = await this.settingRepo.findOne({ where: { key: 'site_name' } });
    const instSetting = await this.settingRepo.findOne({ where: { key: 'institution_name' } });
    const siteName = siteSetting?.value || 'Hatay Mustafa Kemal Üniversitesi';
    const instName = instSetting?.value || 'Hatay Mustafa Kemal Üniversitesi';

    const base = `Sen ${instName} Teknoloji Transfer Ofisi (TTO) için çalışan bir dijital asistansın. Kullanıcılar TTO çalışanları, araştırmacılar ve yöneticidir.

TEMEL KURALLAR:
• Türkçe cevap ver (kullanıcı başka dilde yazmadıysa).
• Emin değilsen uydurma — "bu veri sistemimde yok" de.
• Proje sayıları, yayın sayıları, rakamlar için AŞAĞIDA verilen bağlamı kullan; dış bilgi uydurma.
• Resmi ama akıcı bir ton — bürokratik klişelerden kaçın.
• Uzun listeler yerine yapılandırılmış özetler ver.`;

    let ctx = '';

    if (context === 'project' || context === 'general') {
      const totalProjects = await this.projectRepo.count();
      const activeProjects = await this.projectRepo.count({ where: { status: 'active' } });
      const completedProjects = await this.projectRepo.count({ where: { status: 'completed' } });
      const recentProjects = await this.projectRepo
        .createQueryBuilder('p')
        .select(['p.title', 'p.type', 'p.status', 'p.faculty'])
        .orderBy('p.createdAt', 'DESC')
        .limit(10)
        .getMany();
      ctx += `\n\nPROJE BAĞLAMI:
- Toplam proje: ${totalProjects}
- Aktif: ${activeProjects} | Tamamlanan: ${completedProjects}
- Son kayıt proje örnekleri:
${recentProjects.map(p => `  • ${p.title} [${p.type}, ${p.status}${p.faculty ? ', ' + p.faculty : ''}]`).join('\n')}`;
    }

    if (context === 'competitions' || context === 'general') {
      const openComps = await this.compRepo
        .createQueryBuilder('c')
        .where('c.status = :s', { s: 'open' })
        .orderBy('c.deadline', 'ASC')
        .limit(10)
        .getMany();
      if (openComps.length > 0) {
        ctx += `\n\nAKTİF YARIŞMA/DESTEK ÇAĞRILARI (ilk 10):
${openComps.map(c => `  • ${c.title} — ${c.organizer} — son başvuru: ${c.deadline || 'belirsiz'}`).join('\n')}`;
      }
    }

    if (userId) {
      const me = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['role'],
      });
      if (me) {
        ctx += `\n\nKULLANICI PROFİLİ:
- Ad: ${me.title || ''} ${me.firstName} ${me.lastName}
- E-posta: ${me.email}
- Fakülte: ${me.faculty || '—'} | Bölüm: ${(me as any).department || '—'}
- Rol: ${me.role?.name || '—'}`;
      }
    }

    return base + ctx + `\n\nASİSTAN GÖREVLERİN:
1. Proje yönetimi konusunda yardım (yeni proje açma, durum sorgulama, partner bilgisi).
2. Açık rakipler/destekler hakkında güncel bilgi.
3. Yayın yönetimi yardımı (yayın ekleme, bibliyometri yorumlama).
4. Analitik raporları yorumlama.
5. Sistem kullanımı rehberliği (hangi sekmede ne yapılır).
Cevapların kısa, uygulanabilir ve eyleme dönük olsun. Bilgiyle uyuşmayan bir şey sorulursa dürüstçe "bu bilgi portalımda yok" de.`;
  }
}
