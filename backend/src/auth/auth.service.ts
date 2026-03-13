import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../database/entities/user.entity';
import { Role } from '../database/entities/role.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.userRepo.createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permissions')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) throw new UnauthorizedException('Geçersiz email veya şifre');
    if ((user as any).approvalStatus === 'pending') throw new UnauthorizedException('Hesabınız henüz onaylanmamış. Lütfen yöneticinizle iletişime geçin.');
    if ((user as any).approvalStatus === 'rejected') throw new UnauthorizedException('Hesabınız reddedildi. Lütfen yöneticinizle iletişime geçin.');
    if (!user.isActive) throw new UnauthorizedException('Hesabınız aktif değil');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new UnauthorizedException('Geçersiz email veya şifre');

    const payload = { sub: user.id, email: user.email, roleId: user.roleId, roleName: user.role?.name || '' };
    const access_token = this.jwtService.sign(payload);
    const { password: _, ...userOut } = user as any;
    return { access_token, user: userOut };
  }

  async register(dto: { firstName: string; lastName: string; email: string; password: string; title?: string; department?: string; faculty?: string }) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Bu e-posta adresi zaten kayıtlı');

    const defaultRole = await this.roleRepo.findOne({ where: { name: 'Akademisyen' } });
    const hashed = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      ...dto,
      password: hashed,
      roleId: defaultRole?.id,
      isActive: 0 as any,
      approvalStatus: 'pending',
    });
    const saved = await this.userRepo.save(user);
    // Kayıt başarılı — admin onayı bekleniyor, token verilmiyor
    return { pending: true, message: 'Kaydınız alındı. Yönetici onayından sonra giriş yapabilirsiniz.' };
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['role', 'role.permissions'] });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    return user;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userRepo.createQueryBuilder('user')
      .addSelect('user.password').where('user.id = :id', { id: userId }).getOne();
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) throw new UnauthorizedException('Mevcut şifre yanlış');
    user.password = await bcrypt.hash(newPassword, 12);
    await this.userRepo.save(user);
    return { message: 'Şifre başarıyla değiştirildi' };
  }
}
