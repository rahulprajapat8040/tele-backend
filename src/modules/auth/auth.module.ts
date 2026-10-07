import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OTPService } from './otp/otp.service';

@Module({ controllers: [AuthController], providers: [AuthService, OTPService] })
export class AuthModule {}
