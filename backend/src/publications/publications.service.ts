import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Publication } from '../database/entities/publication.entity';

/**
 * Kullanıcının manuel yayın kayıtları için servis.
 * Bir kullanıcı kendi yayınlarını CRUD yapabilir.
 * Admin herkesi yönetebilir.
 */
@Injectable()
export class UserPublicationsService {
  constructor(
    @InjectRepository(Publication) private repo: Repository<Publication>,
  ) {}

  async listForUser(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { isFeatured: 'DESC', year: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(userId: string, dto: Partial<Publication>) {
    const p = this.repo.create({
      ...dto,
      userId,
      title: dto.title || 'Başlıksız yayın',
    });
    return this.repo.save(p);
  }

  async update(id: string, userId: string, isAdmin: boolean, dto: Partial<Publication>) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    if (!isAdmin && p.userId !== userId) {
      throw new ForbiddenException('Sadece kendi yayınlarınızı düzenleyebilirsiniz');
    }
    Object.assign(p, dto);
    return this.repo.save(p);
  }

  async remove(id: string, userId: string, isAdmin: boolean) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    if (!isAdmin && p.userId !== userId) {
      throw new ForbiddenException('Sadece kendi yayınlarınızı silebilirsiniz');
    }
    await this.repo.delete(id);
    return { deleted: true };
  }

  async toggleFeatured(id: string, userId: string, isAdmin: boolean) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    if (!isAdmin && p.userId !== userId) {
      throw new ForbiddenException();
    }
    p.isFeatured = !p.isFeatured;
    return this.repo.save(p);
  }
}
