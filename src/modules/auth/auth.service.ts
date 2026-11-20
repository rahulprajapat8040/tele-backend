import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DeviceInfo, User } from '../database/models';
import { OTPService } from './otp.service';
import {
  generatePhoneHash,
  normalizePhoneNo,
  responseSender,
} from 'src/lib/helper/function.helper';
import { RESPONSE_MESSAGE } from 'src/lib/constant/response-message.constant';
import { LoginDTO, SendOTPDTO, SignupDTO } from './dto/auth.dto';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { DeviceType } from 'src/lib/enum';
import { decryptUserPhone, encrypt } from 'src/lib/helper/encryption.helper';
import { IAuthUser, IJwtPayload } from 'src/lib/interfaces/user.interface';
import { SessionsService } from '../sessions/sessions.service';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly otpService: OTPService,
    private readonly sessionService: SessionsService,
    @InjectModel(DeviceInfo)
    private readonly deviceInfoModel: typeof DeviceInfo,
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly redis: RedisService,
  ) {}

  async sendOTP(dto: SendOTPDTO) {
    const isExist = await this.isUserExist(dto.countryCode, dto.phoneNo);
    if (!isExist) {
      throw new NotFoundException(RESPONSE_MESSAGE.PHONE_NOT_FOUND);
    }
    const identifier = this.getIdentifier(dto.countryCode, dto.phoneNo);
    const res = await this.otpService.generateAuthOTP(identifier);
    return responseSender(RESPONSE_MESSAGE.OTP_SENT, HttpStatus.OK, true, res);
  }

  async login(dto: LoginDTO) {
    const { deviceId, deviceToken, deviceType, countryCode, phoneNo, otp } =
      dto;

    const user = await this.isUserExist(countryCode, phoneNo);

    if (!user) {
      throw new NotFoundException(RESPONSE_MESSAGE.PHONE_NOT_FOUND);
    }

    const identifier = this.getIdentifier(countryCode, phoneNo);
    await this.otpService.verifyAuthOTP(identifier, otp);

    const sessionId = randomUUID();
    const accessTokenExpiresIn = 15 * 60;

    const { accessToken, refreshHash, refreshToken } =
      await this.generateTokens({
        userId: user.id,
        deviceId,
        sessionId,
      });
    await this.upsertDevice({
      deviceId,
      deviceToken,
      refreshHash,
      userId: user.id,
      otp,
      deviceType,
    });

    await this.sessionService.createSession({
      userId: user.id,
      deviceId,
      deviceType,
      sessionId,
      expiresIn: accessTokenExpiresIn,
    });

    return responseSender(
      RESPONSE_MESSAGE.USER_LOGGED_IN,
      HttpStatus.OK,
      true,
      { accessToken, refreshToken },
    );
  }

  async signup(dto: SignupDTO) {
    const {
      firstName,
      lastName,
      countryCode,
      phoneNo,
      otp,
      deviceId,
      deviceToken,
      deviceType,
    } = dto;
    const identifier = this.getIdentifier(countryCode, phoneNo);
    await this.otpService.verifyAuthOTP(identifier, otp);
    const isExist = await this.isUserExist(countryCode, phoneNo);
    if (isExist) {
      throw new BadRequestException(RESPONSE_MESSAGE.PHONE_USED);
    }
    const normalizedPhone = normalizePhoneNo(countryCode, phoneNo);
    const user = await this.userModel.create({
      firstName,
      lastName,
      countryCode,
      phoneNo: encrypt(normalizedPhone),
      phoneHash: generatePhoneHash(normalizedPhone),
    });

    const sessionId = randomUUID();
    const accessTokenExpiresIn = 15 * 60;

    const { accessToken, refreshHash, refreshToken } =
      await this.generateTokens({
        userId: user.id,
        deviceId,
        sessionId,
      });
    await this.sessionService.createSession({
      userId: user.id,
      deviceId,
      deviceType,
      sessionId,
      expiresIn: accessTokenExpiresIn,
    });
    await this.upsertDevice({
      deviceId,
      deviceToken,
      refreshHash,
      otp,
      deviceType,
      userId: user.id,
    });
    return responseSender(
      RESPONSE_MESSAGE.ACCOUNT_CREATED,
      HttpStatus.CREATED,
      true,
      { accessToken, refreshToken },
    );
  }

  async getMe(userData: IAuthUser) {
    const cacheKey = `user:profile:${userData.userId}`;

    // 1. Check Redis first
    const cachedUser = await this.redis.get(cacheKey);

    if (cachedUser) {
      return responseSender(
        RESPONSE_MESSAGE.DATA_FETCHED,
        HttpStatus.OK,
        true,
        JSON.parse(cachedUser),
      );
    }

    // 2. Fallback to PostgreSQL
    const user = await this.userModel.findByPk(userData.userId, {
      attributes: ['id', 'firstName', 'lastName', 'countryCode', 'phoneNo'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 3. Decrypt phone number if necessary
    const decryptedUser = decryptUserPhone(user);

    const profile = {
      id: decryptedUser.id,
      firstName: decryptedUser.firstName,
      lastName: decryptedUser.lastName,
      countryCode: decryptedUser.countryCode,
      phoneNo: decryptedUser.phoneNo,
    };

    // 4. Cache for 10 minutes
    await this.redis.set(cacheKey, JSON.stringify(profile), 600);

    return responseSender(
      RESPONSE_MESSAGE.DATA_FETCHED,
      HttpStatus.OK,
      true,
      decryptedUser,
    );
  }

  private async generateTokens(data: {
    deviceId: string;
    userId: string;
    sessionId: string;
  }) {
    const accessToken = this.jwtService.sign(data, {
      secret: process.env.JWT_ACCESS_SECRET!,
      expiresIn: '1d',
    });
    const refreshToken = this.jwtService.sign(data, {
      secret: process.env.JWT_ACCESS_SECRET!,
      expiresIn: '30d',
    });

    const refreshHash = await argon2.hash(refreshToken);

    return { accessToken, refreshToken, refreshHash };
  }

  private async isUserExist(countryCode: string, phoneNo: string) {
    const normalizedPhone = normalizePhoneNo(countryCode, phoneNo);
    const phoneHash = generatePhoneHash(normalizedPhone);
    const res = await this.userModel.findOne({
      where: { phoneHash: phoneHash },
      attributes: ['id'],
    });
    return res;
  }

  private async upsertDevice({
    deviceId,
    deviceToken,
    refreshHash,
    otp,
    userId,
    deviceType,
  }: {
    deviceId: string;
    deviceToken: string;
    deviceType: DeviceType;
    refreshHash: string;
    otp: string;
    userId: string;
  }) {
    let device = await this.deviceInfoModel.findOne({
      where: { deviceId, userId },
    });
    if (!device) {
      device = await this.deviceInfoModel.create({
        deviceId,
        deviceToken,
        refreshHash,
        otp,
        userId,
        deviceType,
      });
    } else {
      device = await device.update({
        deviceToken,
        refreshHash,
        deviceType,
        otp,
      });
    }

    return device;
  }

  private getIdentifier(countryCode: string, phoneNo: string): string {
    return `${countryCode}:${phoneNo}`;
  }
}
