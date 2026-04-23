import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrainingProgram, TrainingRegistration } from '../database/entities/training.entities';

@Injectable()
export class TrainingService {
  constructor(
    @InjectRepository(TrainingProgram) private progRepo: Repository<TrainingProgram>,
    @InjectRepository(TrainingRegistration) private regRepo: Repository<TrainingRegistration>,
  ) {}

  // ── Programs ──────────────────────────────────────────────
  async listPrograms(q: { status?: string; category?: string; type?: string; upcoming?: string } = {}) {
    const qb = this.progRepo.createQueryBuilder('p').where('p.isActive = true');
    if (q.status) qb.andWhere('p.status = :st', { st: q.status });
    if (q.category) qb.andWhere('p.category = :c', { c: q.category });
    if (q.type) qb.andWhere('p.type = :t', { t: q.type });
    if (q.upcoming === 'true') {
      qb.andWhere('p.status = :su', { su: 'upcoming' });
      qb.andWhere("p.startDate >= :today", { today: new Date().toISOString().slice(0, 10) });
    }
    qb.orderBy('p.startDate', 'ASC');
    const programs = await qb.getMany();

    // Her program için kayıtlı kişi sayısını hesapla
    const counts = new Map<string, number>();
    if (programs.length > 0) {
      const raw = await this.regRepo
        .createQueryBuilder('r')
        .select('r."programId"', 'programId')
        .addSelect('COUNT(*)::int', 'count')
        .where('r."programId" IN (:...ids)', { ids: programs.map(p => p.id) })
        .groupBy('r."programId"')
        .getRawMany();
      for (const r of raw) counts.set(r.programId, +r.count);
    }
    return programs.map(p => ({ ...p, registeredCount: counts.get(p.id) || 0 }));
  }

  async getProgram(id: string) {
    const p = await this.progRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    const registeredCount = await this.regRepo.count({ where: { programId: id } });
    return { ...p, registeredCount };
  }

  async createProgram(dto: any) {
    const p = this.progRepo.create(dto);
    return this.progRepo.save(p);
  }

  async updateProgram(id: string, dto: any) {
    const p = await this.progRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    Object.assign(p, dto);
    return this.progRepo.save(p);
  }

  async deleteProgram(id: string) {
    // Soft delete — isActive=false (kayıtlar korunur)
    await this.progRepo.update(id, { isActive: false });
    return { deleted: true };
  }

  // ── Registrations ─────────────────────────────────────────
  async listRegistrations(programId: string) {
    return this.regRepo.find({
      where: { programId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async listMyRegistrations(userId: string) {
    const regs = await this.regRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
    if (regs.length === 0) return [];
    const programIds = regs.map(r => r.programId);
    const programs = await this.progRepo.findByIds(programIds);
    const pMap = Object.fromEntries(programs.map(p => [p.id, p]));
    return regs.map(r => ({ ...r, program: pMap[r.programId] }));
  }

  async register(userId: string, programId: string) {
    const existing = await this.regRepo.findOne({ where: { userId, programId } });
    if (existing) throw new ConflictException('Bu programa zaten kayıtlısınız');

    // Kapasite kontrolü
    const program = await this.progRepo.findOne({ where: { id: programId, isActive: true } });
    if (!program) throw new NotFoundException('Program bulunamadı');
    const count = await this.regRepo.count({ where: { programId } });
    if (count >= program.maxParticipants) {
      throw new ConflictException('Program kontenjan doldu');
    }

    const r = this.regRepo.create({ userId, programId });
    return this.regRepo.save(r);
  }

  async unregister(userId: string, programId: string) {
    const r = await this.regRepo.findOne({ where: { userId, programId } });
    if (!r) throw new NotFoundException();
    await this.regRepo.delete(r.id);
    return { deleted: true };
  }

  async markAttendance(id: string, attended: boolean) {
    const r = await this.regRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException();
    r.attended = attended;
    return this.regRepo.save(r);
  }

  async submitFeedback(userId: string, programId: string, rating: number, feedback?: string) {
    const r = await this.regRepo.findOne({ where: { userId, programId } });
    if (!r) throw new NotFoundException('Önce kayıt olmalısınız');
    r.rating = Math.max(1, Math.min(5, +rating));
    if (feedback) r.feedback = feedback;
    return this.regRepo.save(r);
  }

  async issueCertificate(id: string) {
    const r = await this.regRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException();
    if (!r.attended) throw new ConflictException('Sertifika için katılım işaretlenmiş olmalı');
    r.certificateIssued = true;
    r.certificateUrl = `/training/certificates/${r.id}`;  // placeholder
    return this.regRepo.save(r);
  }
}
