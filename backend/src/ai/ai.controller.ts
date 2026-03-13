import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {

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
