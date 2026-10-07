import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { OTPReqDTO, SignupDTO } from './dto/auth.dto';
import { responseSender } from 'src/utils/helper/function.helper';
import { RESPONSE_MESSAGE } from 'src/utils/constant/response.constant';
import { OTPService } from './otp/otp.service';
import { DATABASE } from 'src/database/database.provider';
import type { Database } from 'src/database/database.provider';
import { and, eq } from 'drizzle-orm';
import { devices, sessions, users } from 'src/database/drizzle';
import * as argon from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OTPService,
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
    await this.checkIsExist(countryCode, phoneNo);

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
      // await tx.insert(sessions).values({ deviceId: device.id });
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
    if (isExist) {
      throw new BadRequestException('Account is alredy created. Try login!');
    }
    return true;
  }
}
