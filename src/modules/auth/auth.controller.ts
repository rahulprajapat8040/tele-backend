import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OTPReqDTO, SignupDTO } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp')
  sendOTP(@Body() dto: OTPReqDTO) {
    return this.authService.sendOTP(dto);
  }

  @Post('signup')
  signup(@Body() dto: SignupDTO) {
    return this.authService.signup(dto);
  }
}
