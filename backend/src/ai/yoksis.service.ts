import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';

/**
 * YÖKSİS Web Servis Entegrasyonu
 *
 * Resmi servis: https://servisler.yok.gov.tr/ws/ozgecmisv1?wsdl
 * Erişim için:
 *   1. yoksis.yok.gov.tr'den IP tanımlaması yapılmalı
 *   2. YOKSIS_USERNAME ve YOKSIS_PASSWORD env değişkenleri set edilmeli
 *   3. Sunucu IP'si YÖK'e tescil ettirilmeli
 *
 * Kimlik bilgileri olmadan "demo modu" çalışır — gerçek veri çekilmez.
 */
@Injectable()
export class YoksisService {
  private readonly logger = new Logger(YoksisService.name);
  private readonly username = process.env.YOKSIS_USERNAME || '';
  private readonly password = process.env.YOKSIS_PASSWORD || '';
  private readonly isConfigured = !!(process.env.YOKSIS_USERNAME && process.env.YOKSIS_PASSWORD);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  /**
   * Kullanıcının YÖKSİS profilini senkronize et
   * TC kimlik no ile özgeçmiş verilerini çeker ve User'a kaydeder
   */
  async syncProfile(userId: string, tcNo: string): Promise<{
    success: boolean;
    message: string;
    data?: Partial<User>;
  }> {
    if (!tcNo || tcNo.length !== 11) {
      return { success: false, message: 'Geçersiz TC Kimlik Numarası (11 hane olmalı)' };
    }

    if (!this.isConfigured) {
      return {
        success: false,
        message: 'YÖKSİS entegrasyonu henüz yapılandırılmamış. Sistem yöneticisi YOKSIS_USERNAME ve YOKSIS_PASSWORD env değişkenlerini ayarlamalıdır.',
      };
    }

    try {
      const profile = await this.callYoksisOzgecmis(tcNo);
      if (!profile) {
        return { success: false, message: 'YÖKSİS\'ten veri alınamadı. TC numaranızı ve YÖKSİS erişiminizi kontrol edin.' };
      }

      // Kullanıcıyı güncelle
      const updateData: Partial<User> = {};
      if (profile.faculty) updateData.faculty = profile.faculty;
      if (profile.department) updateData.department = profile.department;
      if (profile.title) updateData.title = profile.title;
      if (profile.expertise) updateData.expertise = profile.expertise;
      if (profile.bio) updateData.bio = profile.bio;

      await this.userRepo.update(userId, updateData);

      return {
        success: true,
        message: 'YÖKSİS verileri başarıyla senkronize edildi',
        data: updateData,
      };
    } catch (err) {
      this.logger.error('YÖKSİS sync error: ' + err);
      return { success: false, message: 'YÖKSİS bağlantı hatası: ' + (err as any).message };
    }
  }

  /**
   * YÖKSİS özgeçmiş servisi SOAP çağrısı
   * WSDL: https://servisler.yok.gov.tr/ws/ozgecmisv1?wsdl
   */
  private async callYoksisOzgecmis(tcNo: string): Promise<any> {
    // SOAP envelope
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ozg="http://ozgecmis.yoksis.yok.gov.tr/">
  <soapenv:Header/>
  <soapenv:Body>
    <ozg:getOzgecmis>
      <tcKimlikNo>${tcNo}</tcKimlikNo>
    </ozg:getOzgecmis>
  </soapenv:Body>
</soapenv:Envelope>`;

    const credentials = Buffer.from(this.username + ':' + this.password).toString('base64');

    const res = await fetch('https://servisler.yok.gov.tr/ws/ozgecmisv1', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '"getOzgecmis"',
        'Authorization': 'Basic ' + credentials,
      },
      body: soapBody,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error('HTTP ' + res.status + ': ' + res.statusText);
    }

    const xml = await res.text();
    return this.parseOzgecmisXml(xml);
  }

  /**
   * SOAP XML yanıtını parse eder
   */
  private parseOzgecmisXml(xml: string): any {
    const getVal = (tag: string): string => {
      const m = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
      return m ? m[1].trim() : '';
    };

    const birim = getVal('birimAdi') || getVal('kurumAdi') || '';
    const bolum = getVal('bolumAdi') || getVal('anabilimDali') || '';
    const unvan = getVal('unvanAdi') || '';
    const expertise = getVal('uzmanlikAlani') || getVal('arastirmaAlanlari') || '';

    // Biyografi birleştir
    let bio = '';
    if (birim) bio += birim;
    if (bolum) bio += (bio ? ', ' : '') + bolum;

    return {
      faculty: birim || null,
      department: bolum || null,
      title: unvan || null,
      expertise: expertise || null,
      bio: bio || null,
    };
  }

  /**
   * YÖKSİS'ten akademik proje listesi çek
   * (Projeye YÖKSİS proje verisini bağlamak için)
   */
  async getAcademicProjects(tcNo: string): Promise<any[]> {
    if (!this.isConfigured) return [];

    try {
      const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ozg="http://ozgecmis.yoksis.yok.gov.tr/">
  <soapenv:Header/>
  <soapenv:Body>
    <ozg:getProje>
      <tcKimlikNo>${tcNo}</tcKimlikNo>
    </ozg:getProje>
  </soapenv:Body>
</soapenv:Envelope>`;

      const credentials = Buffer.from(this.username + ':' + this.password).toString('base64');
      const res = await fetch('https://servisler.yok.gov.tr/ws/ozgecmisv1', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': '"getProje"',
          'Authorization': 'Basic ' + credentials,
        },
        body: soapBody,
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) return [];
      const xml = await res.text();
      return this.parseProjectsXml(xml);
    } catch {
      return [];
    }
  }

  private parseProjectsXml(xml: string): any[] {
    const projects: any[] = [];
    const matches = xml.matchAll(/<proje[^>]*>([\s\S]*?)<\/proje>/gi);
    for (const m of matches) {
      const block = m[1];
      const getVal = (tag: string) => {
        const r = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
        return r ? r[1].trim() : '';
      };
      projects.push({
        title: getVal('projeAdi') || getVal('baslik'),
        type: getVal('projeRolu') || getVal('destekleyenKurum'),
        startYear: getVal('baslangicYili'),
        endYear: getVal('bitis Yili') || getVal('bitisYili'),
        budget: getVal('butce'),
        description: getVal('aciklama'),
      });
    }
    return projects;
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}
