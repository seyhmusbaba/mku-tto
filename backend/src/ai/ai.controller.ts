import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {

  @Get('orcid/:orcidId')
  async lookupOrcid(@Param('orcidId') orcidId: string) {
    try {
      const res = await fetch(`https://pub.orcid.org/v3.0/${orcidId}/record`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return { error: 'ORCID bulunamadı' };
      const data = await res.json();
      const person = data?.person;
      const works = data?.['activities-summary']?.works?.group || [];
      const name = person?.name;
      return {
        name: name ? `${name['given-names']?.value || ''} ${name['family-name']?.value || ''}`.trim() : null,
        bio: person?.biography?.content || null,
        keywords: person?.keywords?.keyword?.map((k: any) => k.content) || [],
        publicationCount: works.length,
        recentWorks: works.slice(0, 5).map((g: any) => {
          const ws = g['work-summary']?.[0];
          return {
            title: ws?.title?.title?.value,
            year: ws?.['publication-date']?.year?.value,
            type: ws?.type,
            journal: ws?.['journal-title']?.value,
          };
        }).filter((w: any) => w.title),
      };
    } catch {
      return { error: 'ORCID sorgusu başarısız' };
    }
  }

  @Post('generate')
  async generate(@Body() dto: { system: string; userContent: string; maxTokens?: number }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { error: 'ANTHROPIC_API_KEY tanımlı değil. Backend .env dosyasına ANTHROPIC_API_KEY=sk-ant-... ekleyin.' };
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
          max_tokens: dto.maxTokens || 1000,
          system: dto.system,
          messages: [{ role: 'user', content: dto.userContent }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { error: `Anthropic API hatası: ${err?.error?.message || res.status}` };
      }

      const data = await res.json();
      const text = data?.content?.find((b: any) => b.type === 'text')?.text || '';
      return { text };
    } catch (e: any) {
      return { error: e.message || 'Bağlantı hatası' };
    }
  }
}
