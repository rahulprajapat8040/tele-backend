import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDTO, SignupDTO, SendOTPDTO } from './dto/auth.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { IAuthUser } from 'src/lib/interfaces/user.interface';
import type { Response } from 'express';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from 'src/lib/constant/constant';

@ApiBearerAuth('access-token')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('send-otp')
  sendOTP(@Body() dto: SendOTPDTO) {
    return this.authService.sendOTP(dto);
  }

  @Post('signup')
  signup(@Body() dto: SignupDTO) {
    return this.authService.signup(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    const response = await this.authService.login(dto);
    if (dto.deviceType === 'WEB') {
      const isProduction = process.env.NODE_ENV === 'production';

      res.cookie(ACCESS_TOKEN_KEY, response.data.accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        path: '/',
      });

      res.cookie(REFRESH_TOKEN_KEY, response.data.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });
    }
    return response;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: IAuthUser) {
    return this.authService.getMe(user);
  }
}
