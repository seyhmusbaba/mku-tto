import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

function requiredSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET env değişkeni tanımlı değil veya çok kısa (min 16 karakter). Güvenli bir secret ayarlayın.');
  }
  return s;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requiredSecret(),
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, email: payload.email, roleId: payload.roleId, roleName: payload.roleName || '' };
  }
}
