import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { LoginDTO, OTPReqDTO, SignupDTO } from './dto/auth.dto';
import { responseSender } from 'src/utils/helper/function.helper';
import { RESPONSE_MESSAGE } from 'src/utils/constant/response.constant';
import { OTPService } from './otp/otp.service';
import { DATABASE } from 'src/database/database.provider';
import type { Database } from 'src/database/database.provider';
import { and, eq } from 'drizzle-orm';
import { devices, sessions, users } from 'src/database/drizzle';
import * as argon from 'argon2';
import { JwtService } from '@nestjs/jwt';
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS,
} from 'src/utils/constant/auth.constant';

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OTPService,
    private readonly jwtService: JwtService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async sendOTP(dto: OTPReqDTO) {
    const key = `${dto.deviceName}${dto.countryCode}${dto.phoneNo}`;
    const otp = await this.otpService.generateAuthOTP(key);
    return responseSender(RESPONSE_MESSAGE.OTP_SENT, HttpStatus.OK, true, otp);
  }

  async signup(dto: SignupDTO) {
    const {
      platform,
      deviceName,
      model,
      appVersion,
      countryCode,
      phoneNo,
      firstName,
      lastName,
      otp,
    } = dto;
    const key = `${dto.deviceName}${dto.countryCode}${dto.phoneNo}`;
    await this.otpService.verifyAuthOTP(key, otp);
    const isExist = await this.checkIsExist(countryCode, phoneNo);
    if (isExist) {
      throw new BadRequestException('Account is alredy created. Try login!');
    }
    const res = await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ firstName, lastName, countryCode, phoneNo })
        .returning();
      const [device] = await tx
        .insert(devices)
        .values({
          userId: user.id,
          model,
          name: deviceName,
          appVersion,
          platform,
        })
        .returning();
      const { accessToken, refreshToken } = await this.generateAuthTokens(
        device.id,
        user.id,
      );
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
      const refreshTokenHash = await argon.hash(refreshToken);
      await tx
        .insert(sessions)
        .values({ deviceId: device.id, refreshTokenHash, expiresAt });
      return { ...user, accessToken, refreshToken };
    });
    return responseSender(
      RESPONSE_MESSAGE.ACCOUNT_CREATED,
      HttpStatus.CREATED,
      true,
      res,
    );
  }

  async login(dto: LoginDTO) {
    const {
      platform,
      deviceName,
      model,
      appVersion,
      countryCode,
      phoneNo,
      otp,
    } = dto;

    const key = `${deviceName}${countryCode}${phoneNo}`;
    await this.otpService.verifyAuthOTP(key, otp);
    const isExist = await this.checkIsExist(countryCode, phoneNo);
    if (!isExist) {
      throw new BadRequestException('Account not exist. Try signup!');
    }
    const res = await this.db.transaction(async (tx) => {
      // tx.
    });
  }

  private async checkIsExist(countryCode: string, phoneNo: string) {
    const [isExist] = await this.db
      .select()
      .from(users)
      .where(
        and(eq(users.countryCode, countryCode), eq(users.phoneNo, phoneNo)),
      )
      .limit(1);

    return isExist;
  }

  private async generateAuthTokens(deviceId: string, userId: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { deviceId, userId },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TOKEN_TTL },
      ),
      this.jwtService.signAsync(
        { deviceId, userId },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: REFRESH_TOKEN_TTL,
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }
}
