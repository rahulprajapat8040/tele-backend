import { HttpStatus, Injectable } from '@nestjs/common';
import { OTPReqDTO } from './dto/auth.dto';
import { otpGenerator, responseSender } from 'src/utils/helper/function.helper';
import { RESPONSE_MESSAGE } from 'src/utils/constant/response.constant';
import { OTPService } from './otp/otp.service';

@Injectable()
export class AuthService {
  constructor(private readonly otpService: OTPService) {}

  async sendOTP(dto: OTPReqDTO) {
    const key = `${dto.deviceName}${dto.countryCode}${dto.phoneNo}`;
    const otp = await this.otpService.generateAuthOTP(key);
    return responseSender(RESPONSE_MESSAGE.OTP_SENT, HttpStatus.OK, true, otp);
  }
}
