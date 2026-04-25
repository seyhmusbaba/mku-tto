import { Injectable } from '@nestjs/common';

/**
 * Proje metni YZ uygunluk kontrolü
 * Claude API üzerinden çalışır
 */
@Injectable()
export class AiComplianceService {

  /**
   * Proje metninin akademik ve etik uygunluğunu kontrol et
   */
  async checkProjectCompliance(data: {
    title: string;
    description: string;
    projectText: string;
    type: string;
    ethicsRequired?: boolean;
  }): Promise<{
    score: number;
    level: 'excellent' | 'good' | 'warning' | 'critical';
    summary: string;
    issues: Array<{ type: string; severity: 'info' | 'warning' | 'error'; message: string }>;
    suggestions: string[];
    ethicsFlags: string[];
    plagiarismRisk: 'low' | 'medium' | 'high';
    completenessScore: number;
    clarityScore: number;
  }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return this.fallbackCheck(data);
    }

    const prompt = `Sen bir akademik proje değerlendirme uzmanısın. Aşağıdaki proje metnini çok yönlü olarak değerlendir.

PROJE BİLGİLERİ:
Başlık: ${data.title}
Tür: ${data.type}
Özet: ${data.description || '(girilmemiş)'}
Proje Metni: ${data.projectText || '(girilmemiş)'}

Şu kriterlere göre değerlendir:

1. AKADEMİK UYGUNLUK: Bilimsel yöntem, terminoloji, kapsam uygunluğu
2. ETİK UYGUNLUK: İnsan/hayvan deneyi, gizlilik, çıkar çatışması riski var mı?
3. ÖZGÜNLÜK RİSKİ: İntihal veya kopyala-yapıştır belirtileri var mı?
4. TAMAMLANMA SKORU: Yeterli detay var mı? (0-100)
5. AÇIKLIK SKORU: Anlaşılırlık, akış (0-100)
6. GENEL UYGUNLUK SKORU: Tüm kriterler (0-100)

SADECE şu JSON formatında yanıt ver, başka hiçbir şey yazma:
{
  "score": 85,
  "level": "good",
  "summary": "Kısa değerlendirme özeti",
  "issues": [
    {"type": "ethics", "severity": "warning", "message": "Sorun açıklaması"}
  ],
  "suggestions": ["Öneri 1", "Öneri 2"],
  "ethicsFlags": ["Etik uyarı varsa buraya"],
  "plagiarismRisk": "low",
  "completenessScore": 75,
  "clarityScore": 80
}

level değerleri: "excellent" (90+), "good" (70-89), "warning" (50-69), "critical" (50 altı)
plagiarismRisk değerleri: "low", "medium", "high"`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) return this.fallbackCheck(data);

      const responseData = await res.json();
      const text = responseData?.content?.[0]?.text || '';
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch {
      return this.fallbackCheck(data);
    }
  }

  /**
   * API erişimi yoksa basit kural tabanlı kontrol
   */
  private fallbackCheck(data: any) {
    const issues: any[] = [];
    const suggestions: string[] = [];
    const ethicsFlags: string[] = [];
    let score = 60;

    if (!data.projectText || data.projectText.length < 100) {
      issues.push({ type: 'completeness', severity: 'error', message: 'Proje metni çok kısa veya girilmemiş' });
      suggestions.push('Proje metnini en az 500 kelime ile detaylandırın');
      score -= 20;
    } else if (data.projectText.length > 200) {
      score += 15;
    }

    if (!data.description || data.description.length < 50) {
      issues.push({ type: 'completeness', severity: 'warning', message: 'Proje özeti yetersiz' });
      suggestions.push('Projeyi 2-3 cümleyle net şekilde özetleyin');
      score -= 10;
    }

    const ethicsKeywords = ['insan', 'hasta', 'hayvan', 'deneği', 'gönüllü', 'kişisel veri', 'mahremiyet'];
    for (const kw of ethicsKeywords) {
      if ((data.projectText + data.description).toLowerCase().includes(kw)) {
        ethicsFlags.push('Proje insanları veya hassas verileri içerebilir - Etik Kurul onayı gerekebilir');
        break;
      }
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      level: score >= 80 ? 'good' : score >= 60 ? 'warning' : 'critical' as any,
      summary: 'Temel kontrol tamamlandı. Daha detaylı analiz için YZ uygunluk kontrolü çalıştırın.',
      issues,
      suggestions,
      ethicsFlags,
      plagiarismRisk: 'low' as any,
      completenessScore: data.projectText?.length > 500 ? 75 : 40,
      clarityScore: 60,
    };
  }
}
