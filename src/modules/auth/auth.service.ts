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
import { LoginDTO, SignupDTO } from './dto/auth.dto';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Sequelize } from 'sequelize-typescript';
import { DeviceType } from 'src/lib/enum';
import { encrypt } from 'src/lib/helper/encryption.helper';
import { IAuthUser } from 'src/lib/interfaces/user.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly otpService: OTPService,
    @InjectModel(DeviceInfo)
    private readonly deviceInfoModel: typeof DeviceInfo,
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}

  async sendOTP(identifier: string) {
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
    const { accessToken, refreshHash, refreshToken } =
      await this.generateTokens({
        userId: user.id,
        deviceId,
      });
    await this.upsertDevice({
      deviceId,
      deviceToken,
      refreshHash,
      userId: user.id,
      otp,
      deviceType,
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
    const { accessToken, refreshHash, refreshToken } =
      await this.generateTokens({
        userId: user.id,
        deviceId,
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

  async getMe(user: IAuthUser) {
    const res = await this.userModel.findByPk(user.userId);
    return responseSender(
      RESPONSE_MESSAGE.DATA_FETCHED,
      HttpStatus.OK,
      true,
      res,
    );
  }

  private async generateTokens(data: { deviceId: string; userId: string }) {
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
    console.log('sss', phoneHash);
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
