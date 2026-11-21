import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/sequelize';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_KEY } from 'src/lib/constant/constant';
import { IAuthUser, IJwtPayload } from 'src/lib/interfaces/user.interface';
import { User } from 'src/modules/database/models';
import { SessionsService } from 'src/modules/sessions/sessions.service';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
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

    const user = await this.usersService.getUserProfile(payload.userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      ...user,
      sessionId: payload.sessionId,
    } as IAuthUser;
  }
}
