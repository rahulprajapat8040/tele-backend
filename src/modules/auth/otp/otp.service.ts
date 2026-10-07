import { RedisService } from 'src/redis/redis.service';
import { otpGenerator } from 'src/utils/helper/function.helper';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

interface StoredOTP {
  hash: string;
  attempts: number;
}

@Injectable()
export class OTPService {
  private readonly OTP_TTL = 5 * 60;

  private readonly RESEND_COOLDOWN = 60;

  private readonly REQUEST_LIMIT = 5;
  private readonly REQUEST_WINDOW = 15 * 60;

  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCK_TIME = 15 * 60;

  constructor(private readonly redis: RedisService) {}

  async generateAuthOTP(identifier: string) {
    const normalizedIdentifier = this.normalizedIdentifier(identifier);

    await this.checkLock(normalizedIdentifier);
    await this.checkRequestLimit(normalizedIdentifier);
    await this.checkResendCooldown(normalizedIdentifier);

    const otp = this.generateOTP();

    const hash = await argon2.hash(otp);

    const otpData: StoredOTP = {
      hash,
      attempts: 0,
    };

    await this.redis.set(
      this.getOtpKey(normalizedIdentifier),
      JSON.stringify(otpData),
      this.OTP_TTL,
    );

    await this.redis.set(
      this.getCooldownKey(normalizedIdentifier),
      '1',
      this.RESEND_COOLDOWN,
    );

    await this.recordRequest(normalizedIdentifier);

    return otp;
  }

  async verifyAuthOTP(identifier: string, otp: string): Promise<boolean> {
    const normalizedIdentifier = this.normalizedIdentifier(identifier);

    await this.checkLock(normalizedIdentifier);

    const key = this.getOtpKey(normalizedIdentifier);

    const stored = await this.redis.get(key);

    if (!stored) {
      throw new BadRequestException('OTP has expired or does not exist.');
    }

    const otpData = this.parseOTPData(stored);

    const isValid = await argon2.verify(otpData.hash, otp);

    if (!isValid) {
      await this.handleFailedAttempt(normalizedIdentifier, otpData);

      throw new BadRequestException('Invalid OTP.');
    }

    /**
     * OTP is single-use.
     */
    await this.redis.delete(key);

    return true;
  }

  private async checkLock(identifier: string) {
    const key = this.getLockKey(identifier);

    const ttl = await this.redis.ttl(key);

    if (ttl > 0) {
      throw new BadRequestException(
        `Too many attempts. Please try again in ${ttl} seconds.`,
      );
    }
  }

  private async checkRequestLimit(identifier: string) {
    const key = this.getRequestKey(identifier);

    const value = await this.redis.get(key);

    if (!value) {
      return;
    }

    const requestCount = Number(value);

    if (requestCount > this.MAX_ATTEMPTS) {
      const ttl = await this.redis.ttl(key);
      throw new BadRequestException(
        `Too many OTP requests. Please try again in ${ttl} seconds.`,
      );
    }
  }

  private async checkResendCooldown(identifier: string): Promise<void> {
    const key = this.getCooldownKey(identifier);

    const exist = await this.redis.exists(key);

    if (!exist) {
      return;
    }

    const ttl = await this.redis.ttl(key);

    throw new BadRequestException(
      `Please wait ${ttl} seconds before requesting another OTP.`,
    );
  }

  private async recordRequest(identifier: string): Promise<void> {
    const key = this.getRequestKey(identifier);

    const count = await this.redis.increment(key);

    if (count === 1) {
      await this.redis.expire(key, this.REQUEST_WINDOW);
    }
  }

  private async handleFailedAttempt(
    identifier: string,
    otpData: StoredOTP,
  ): Promise<void> {
    otpData.attempts += 1;

    const otpKey = this.getOtpKey(identifier);
    if (otpData.attempts >= this.MAX_ATTEMPTS) {
      await this.redis.delete(otpKey);

      await this.redis.set(this.getLockKey(identifier), '1', this.LOCK_TIME);

      throw new BadRequestException(
        `Too many incorrect attempts. Please try again later.`,
      );
    }

    const ttl = await this.redis.ttl(otpKey);

    if (ttl > 0) {
      await this.redis.set(otpKey, JSON.stringify(otpData), ttl);
    }
  }

  private parseOTPData(value: string): StoredOTP {
    try {
      const data = JSON.parse(value);

      if (
        typeof data?.hash !== 'string' ||
        typeof data?.attempts !== 'number'
      ) {
        throw new Error();
      }

      return data;
    } catch {
      throw new BadRequestException('Invalid OTP session.');
    }
  }

  private generateOTP(): string {
    return otpGenerator(6);
  }

  private normalizedIdentifier(identifier: string): string {
    return identifier.trim().toLowerCase();
  }

  private getOtpKey(identifier: string): string {
    return `otp:signup:${identifier}`;
  }

  private getCooldownKey(identifier: string): string {
    return `otp:signup:cooldown:${identifier}`;
  }

  private getRequestKey(identifier: string): string {
    return `otp:signup:requests:${identifier}`;
  }

  private getLockKey(identifier: string): string {
    return `otp:signup:lock:${identifier}`;
  }
}
