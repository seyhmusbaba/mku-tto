import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../database/entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private repo: Repository<Notification>) {}

  async create(data: { userId: string; title: string; message?: string; type?: string; link?: string }) {
    const n = new Notification();
    n.userId = data.userId;
    n.title = data.title;
    n.message = data.message || null;
    n.type = data.type || 'info';
    n.link = data.link || null;
    n.isRead = 0;
    return this.repo.save(n);
  }

  async findForUser(userId: string) {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 });
  }

  async markRead(id: string, userId: string) {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) return;
    n.isRead = 1;
    return this.repo.save(n);
  }

  async markAllRead(userId: string) {
    await this.repo.createQueryBuilder().update(Notification).set({ isRead: 1 } as any).where('userId = :userId AND isRead = 0', { userId }).execute();
  }

  async unreadCount(userId: string) {
    return this.repo.count({ where: { userId, isRead: 0 as any } });
  }

  async deleteOne(id: string, userId: string) {
    await this.repo.delete({ id, userId });
  }
}
