import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OTPReqDTO } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp')
  sendOTP(@Body() dto: OTPReqDTO) {
    return this.authService.sendOTP(dto);
  }

  @Post()
  signup() {}
}
