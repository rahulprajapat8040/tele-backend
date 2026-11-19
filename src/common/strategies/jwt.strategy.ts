import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IAuthUser, IJwtPayload } from 'src/lib/interfaces/user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: IJwtPayload): Promise<IAuthUser> {
    if (!payload.userId) {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      userId: payload.userId,
      deviceId: payload.deviceId,
    } as IAuthUser;
  }
}
