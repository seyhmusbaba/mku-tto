import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../database/entities/user.entity';
import { Role } from '../database/entities/role.entity';
import { Project } from '../database/entities/project.entity';
import { ProjectMember } from '../database/entities/project-member.entity';
import { ProfileVisit } from '../database/entities/profile-visit.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(ProjectMember) private memberRepo: Repository<ProjectMember>,
    @InjectRepository(ProfileVisit) private visitRepo: Repository<ProfileVisit>,
  ) {}

  async findAll(query?: any) {
    const { search, limit = 50, page = 1 } = query || {};
    const qb = this.userRepo.createQueryBuilder('user').leftJoinAndSelect('user.role', 'role');
    if (search) qb.where('(user.firstName ILIKE :s OR user.lastName ILIKE :s OR user.email ILIKE :s)', { s: '%' + search + '%' });
    qb.orderBy('user.createdAt', 'DESC');
    const [data, total] = await qb.skip((+page-1)*+limit).take(+limit).getManyAndCount();
    return { data, total, page:+page, limit:+limit, totalPages: Math.ceil(total/+limit) };
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOne({ where: { id }, relations: ['role', 'role.permissions'] });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    return user;
  }

  async findUserProjects(userId: string) {
    const owned = await this.projectRepo.find({
      where: { ownerId: userId },
      relations: ['owner', 'members'],
      order: { createdAt: 'DESC' },
    });
    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ['project', 'project.owner'],
    });
    const seen = new Set<string>();
    const memberProjects = memberships
      .filter(m => {
        if (!m.project || m.project.ownerId === userId) return false;
        if (seen.has(m.project.id)) return false;
        seen.add(m.project.id);
        return true;
      })
      .map(m => ({ ...m.project, memberRole: m.role }));
    return { owned, member: memberProjects };
  }

  async create(dto: any) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Bu email zaten kullanılıyor');
    const user = new User();
    Object.assign(user, dto);
    user.password = await bcrypt.hash(dto.password, 12);
    (user as any).isActive = true;
    return this.userRepo.save(user);
  }

  async update(id: string, dto: any) {
    const user = await this.findOne(id);
    if (dto.password) dto.password = await bcrypt.hash(dto.password, 12);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.userRepo.manager.query('UPDATE projects SET "ownerId" = NULL WHERE "ownerId" = $1', [id]);
    await this.userRepo.delete(id);
    return { deleted: true, id };
  }

  async deactivate(id: string) {
    const user = await this.findOne(id);
    (user as any).isActive = false;
    return this.userRepo.save(user);
  }

  findPending() {
    return this.userRepo.find({
      where: { approvalStatus: 'pending' } as any,
      relations: ['role'],
      order: { createdAt: 'DESC' } as any,
    });
  }

  async approve(id: string, roleId?: string) {
    const user = await this.findOne(id);
    (user as any).approvalStatus = 'approved';
    (user as any).isActive = true;
    if (roleId) user.roleId = roleId;
    return this.userRepo.save(user);
  }

  async reject(id: string, reason?: string) {
    const user = await this.findOne(id);
    (user as any).approvalStatus = 'rejected';
    (user as any).isActive = false;
    return this.userRepo.save(user);
  }

  async updateAvatar(userId: string, avatar: string) {
    const user = await this.findOne(userId);
    user.avatar = avatar;
    return this.userRepo.save(user);
  }

  async assignRole(userId: string, roleId: string) {
    const user = await this.findOne(userId);
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Rol bulunamadı');
    user.roleId = roleId;
    return this.userRepo.save(user);
  }

  async recordVisit(profileUserId: string, visitorUserId: string): Promise<void> {
    try {
      const recent = await this.visitRepo.findOne({
        where: { profileUserId: profileUserId, visitorUserId: visitorUserId } as any,
        order: { visitedAt: 'DESC' } as any,
      });
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (recent && new Date((recent as any).visitedAt) > oneDayAgo) return;
      const visit = this.visitRepo.create({
        profileUserId: profileUserId,
        visitorUserId: visitorUserId,
      } as any);
      await this.visitRepo.save(visit);
    } catch (_) {}
  }

  async getRecentVisitors(profileUserId: string, limit = 20): Promise<any[]> {
    try {
      return await this.visitRepo.find({
        where: { profileUserId: profileUserId } as any,
        relations: ['visitor'],
        order: { visitedAt: 'DESC' } as any,
        take: limit,
      });
    } catch (_) {
      return [];
    }
  }
}
