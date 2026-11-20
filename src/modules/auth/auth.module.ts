import { Module } from '@nestjs/common';
import { OTPService } from './otp.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtStrategy } from 'src/common/strategies/jwt.strategy';
import { SessionsService } from '../sessions/sessions.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [
    JwtService,
    AuthService,
    OTPService,
    SessionsService,
    JwtStrategy,
  ],
  controllers: [AuthController],
  exports: [JwtModule, PassportModule, JwtStrategy, AuthService],
})
export class AuthModule {}
