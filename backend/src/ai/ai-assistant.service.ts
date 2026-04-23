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
  context?: 'general' | 'project' | 'competitions' | 'publications';
  maxTokens?: number;
}

/**
 * PORTA Asistan — gerçek veri bağlamı ile Claude API'ye proxy.
 *
 * Frontend'deki floating chat butonu bu endpoint'e bağlanır; servis
 * kurumsal bağlamı otomatik enjekte eder (proje listesi, aktif rakipler,
 * kullanıcı profili vs.) ki model "Kurumda şu an hangi projeler var?"
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

    // Model seçimi — env'den override edilebilir. Default: en ucuz Haiku.
    // PORTA Asistan ucuz ve hızlı Haiku ile hallediliyor; kalite isterseniz
    // AI_MODEL=claude-3-5-sonnet-latest gibi env ile değiştirebilirsiniz.
    const model = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: Math.min(body.maxTokens || 800, 1500),
          system: systemPrompt,
          messages,
        }),
        signal: AbortSignal.timeout(40000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const anthropicMsg = (err as any)?.error?.message || '';
        const errType = (err as any)?.error?.type || '';
        const combined = `${errType}: ${anthropicMsg}`.trim();

        // Konsola ham hatayı log'la — debugging için
        console.error('[AI Assistant] Anthropic API hatası:', JSON.stringify(err), 'HTTP', res.status, 'model:', model);

        // errType'a göre spesifik mesaj üret — exact match, regex değil
        let userMsg = '';
        if (errType === 'not_found_error') {
          userMsg = `Model "${model}" API anahtarınızla erişilemiyor. Anthropic hesabınızda bu modele henüz erişim aktif olmayabilir — Console → Settings → "Get API access" adımını tamamlayın ya da bakiye ekleyin.`;
        } else if (errType === 'authentication_error') {
          userMsg = 'ANTHROPIC_API_KEY geçersiz. Railway → Backend → Variables bölümünden key\'i kontrol edin.';
        } else if (errType === 'permission_error') {
          userMsg = 'API anahtarının bu modele erişim izni yok. Anthropic Console → API Keys → key\'in scope\'unu kontrol edin.';
        } else if (errType === 'rate_limit_error' || errType === 'overloaded_error') {
          userMsg = 'Anthropic API şu an yoğun, birkaç saniye sonra tekrar deneyin.';
        } else if (/credit|balance|billing|quota/i.test(anthropicMsg)) {
          userMsg = 'Anthropic hesabında kredi yetersiz. Console → Plans & Billing → "Add credits" ile bakiye ekleyin (veya $5 ücretsiz başlangıç kredisi için "Claim free credits" adımını tamamlayın).';
        } else if (anthropicMsg) {
          userMsg = `Anthropic: ${combined} (HTTP ${res.status}, model: ${model})`;
        } else {
          userMsg = `Anthropic API hatası — HTTP ${res.status}, model: ${model}. Ham yanıt: ${JSON.stringify(err).slice(0, 200)}`;
        }
        throw new HttpException(userMsg, HttpStatus.BAD_GATEWAY);
      }
      const data = await res.json();
      const text = data?.content?.find((b: any) => b.type === 'text')?.text || '';
      return { text, context, model };
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

    const base = `Sen "PORTA" adlı, ${instName} Teknoloji Transfer Ofisi için çalışan dijital asistansın. Kullanıcılar TTO çalışanları, araştırmacılar ve yöneticidir.

YAZIM TARZI (çok önemli):
- Düz sohbet dili kullan, sanki birisiyle WhatsApp'ta yazışıyormuş gibi.
- Markdown kullanma: yıldız (*), bullet (•, -), başlık (##), kod bloğu (\`\`\`), tablo — bunların hiçbiri olmasın.
- Madde işareti yerine düz cümleler kur. "Şunlar var: birincisi ..., ikincisi ..." gibi akıcı anlat.
- Kısa paragraflar halinde yaz. En fazla 3-4 cümle sonrası yeni satır.
- Türkçe cevap ver (kullanıcı başka dilde yazmadıysa).
- Resmi ama akıcı, samimi bir ton. "Sizlere yardımcı olmak için buradayım" gibi klişe açılışlar yok — direkt konuya gir.
- Emin değilsen uydurma: "Bu bilgi şu an portalımda yok" diye açıkça söyle.
- Rakamlar için AŞAĞIDA verilen bağlamı kullan; dış bilgi uydurma.`;

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
        .where('c.status = :s', { s: 'active' })
        .andWhere('c.isActive = true')
        .orderBy('c.deadline', 'ASC')
        .limit(10)
        .getMany();
      if (openComps.length > 0) {
        ctx += `\n\nAKTİF YARIŞMA/DESTEK ÇAĞRILARI (ilk 10):
${openComps.map(c => `  • ${c.title} — ${c.source || 'kaynak belirsiz'} — son başvuru: ${c.deadline || 'belirsiz'}`).join('\n')}`;
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

    return base + ctx + `\n\nSenden beklenen: TTO portalında proje yönetimi, açık destek çağrıları, yayın yönetimi, analitik yorumlama, sistem kullanımı gibi konularda yardım etmen. Cevabını kısa tut, doğrudan konuya gir, listeleme yapma — akıcı sohbet dilinde yaz.`;
  }
}
