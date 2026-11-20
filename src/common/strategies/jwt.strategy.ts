import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/sequelize';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_KEY } from 'src/lib/constant/constant';
import { decryptUserPhone } from 'src/lib/helper/encryption.helper';
import { IAuthUser, IJwtPayload } from 'src/lib/interfaces/user.interface';
import { User } from 'src/modules/database/models';
import { SessionsService } from 'src/modules/sessions/sessions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly sessionsService: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),

        (req: Request): string | null => {
          const token = req?.cookies?.[ACCESS_TOKEN_KEY];
          if (!token || token === 'undefined' || token === 'null') {
            return null;
          }

          return token;
        },
      ]),
      secretOrKey: String(process.env.JWT_ACCESS_SECRET),
      ignoreExpiration: false,
    });
  }

  async validate(payload: IJwtPayload): Promise<IAuthUser> {
    if (!payload.userId || !payload.sessionId) {
      throw new UnauthorizedException('Invalid access token');
    }

    const isValid = await this.sessionsService.isSessionValid(
      payload.sessionId,
      payload.userId,
    );

    if (!isValid) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    const user = await this.userModel.findByPk(payload.userId, {
      attributes: ['id', 'firstName', 'lastName', 'countryCode', 'phoneNo'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: user.id,
      deviceId: payload.deviceId,
      sessionId: payload.sessionId,
      ...decryptUserPhone(user),
    } as IAuthUser;
  }
}
