// ai.controller.ts'e eklenecek endpoint'ler
// Mevcut dosyanın imports kısmına YoksisService ve AiComplianceService ekleyin
// Mevcut controller içine bu metodları ekleyin:

/*
  // YÖKSİS Senkronizasyon
  @Post('yoksis/sync')
  async yoksisSync(@Body() body: { tcNo: string }, @Request() req: any) {
    return this.yoksisService.syncProfile(req.user.userId, body.tcNo);
  }

  @Get('yoksis/status')
  yoksisStatus() {
    return { configured: this.yoksisService.isReady() };
  }

  @Post('yoksis/projects')
  async yoksisProjects(@Body() body: { tcNo: string }) {
    return this.yoksisService.getAcademicProjects(body.tcNo);
  }

  // YZ Proje Uygunluk Kontrolü
  @Post('check-compliance')
  async checkCompliance(@Body() body: {
    title: string;
    description: string;
    projectText: string;
    type: string;
    ethicsRequired?: boolean;
  }) {
    return this.complianceService.checkProjectCompliance(body);
  }
*/

// BU DOSYAYI KULLANMAK YERİNE: ai.controller.ts ve ai.module.ts'i doğrudan güncelleyin
// Aşağıdaki talimatları uygulayın

export const AI_CONTROLLER_ADDITIONS = `
// 1. ai.controller.ts imports'una ekleyin:
import { YoksisService } from './yoksis.service';
import { AiComplianceService } from './ai-compliance.service';

// 2. constructor'a ekleyin:
// private yoksisService: YoksisService,
// private complianceService: AiComplianceService,

// 3. controller metodları olarak ekleyin:
@Post('yoksis/sync')
async yoksisSync(@Body() body: { tcNo: string }, @Request() req: any) {
  return this.yoksisService.syncProfile(req.user.userId, body.tcNo);
}

@Get('yoksis/status')
yoksisStatus() {
  return { configured: this.yoksisService.isReady() };
}

@Post('check-compliance')
async checkCompliance(@Body() body: any) {
  return this.complianceService.checkProjectCompliance(body);
}
`;
