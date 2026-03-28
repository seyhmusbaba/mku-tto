import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {

  @Get('orcid/:orcidId')
  async lookupOrcid(@Param('orcidId') orcidId: string) {
    try {
      const headers = { Accept: 'application/json' };
      const [person, works, employments, educations] = await Promise.all([
        fetch(`https://pub.orcid.org/v3.0/${orcidId}/person`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`https://pub.orcid.org/v3.0/${orcidId}/works`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`https://pub.orcid.org/v3.0/${orcidId}/employments`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`https://pub.orcid.org/v3.0/${orcidId}/educations`, { headers }).then(r => r.json()).catch(() => ({})),
      ]);

      const name = person?.name;
      const firstName = name?.['given-names']?.value || '';
      const lastName = name?.['family-name']?.value || '';
      const biography = person?.biography?.content || '';
      const keywords = person?.keywords?.keyword?.map((k: any) => k.content) || [];

      const TYPE_LABELS: Record<string, string> = {
        'journal-article': 'Dergi Makalesi', 'conference-paper': 'Konferans',
        'book': 'Kitap', 'book-chapter': 'Kitap Bölümü', 'dissertation': 'Tez',
      };

      const workList = (works?.group || []).slice(0, 30).map((g: any) => {
        const ws = g['work-summary']?.[0];
        const extIds = ws?.['external-ids']?.['external-id'] || [];
        const doi = extIds.find((e: any) => e['external-id-type'] === 'doi')?.['external-id-value'] || '';
        return {
          title: ws?.title?.title?.value || '',
          year: ws?.['publication-date']?.year?.value || '',
          type: ws?.type || '',
          typeLabel: TYPE_LABELS[ws?.type] || ws?.type || '',
          journal: ws?.['journal-title']?.value || '',
          doi,
        };
      }).filter((w: any) => w.title);

      const employmentList = (employments?.['affiliation-group'] || []).map((g: any) => {
        const s = g.summaries?.[0]?.['employment-summary'];
        return {
          organization: s?.organization?.name || '',
          role: s?.['role-title'] || '',
          department: s?.['department-name'] || '',
          startYear: s?.['start-date']?.year?.value || '',
          endYear: s?.['end-date']?.year?.value || '',
          current: !s?.['end-date'],
        };
      }).filter((e: any) => e.organization);

      const educationList = (educations?.['affiliation-group'] || []).map((g: any) => {
        const s = g.summaries?.[0]?.['education-summary'];
        return {
          organization: s?.organization?.name || '',
          role: s?.['role-title'] || '',
          department: s?.['department-name'] || '',
          startYear: s?.['start-date']?.year?.value || '',
          endYear: s?.['end-date']?.year?.value || '',
        };
      }).filter((e: any) => e.organization);

      return {
        firstName, lastName, biography, keywords,
        works: workList,
        employments: employmentList,
        educations: educationList,
        publicationCount: workList.length,
      };
    } catch {
      return { error: 'ORCID sorgusu başarısız' };
    }
  }

  @Post('generate')
  async generate(@Body() dto: { system: string; userContent: string; maxTokens?: number }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { error: 'ANTHROPIC_API_KEY tanımlı değil.' };

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
