import { InjectModel } from '@nestjs/sequelize';
import { RedisService } from '../redis/redis.service';
import { User } from '../database/models';
import { Injectable, NotFoundException } from '@nestjs/common';
import { decryptUserPhone } from 'src/lib/helper/encryption.helper';

@Injectable()
export class UsersService {
  constructor(
    private readonly redis: RedisService,
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}
  async getUserProfile(userId: string) {
    const cacheKey = `user:profile:${userId}`;

    // 1. Check Redis first
    const cachedUser = await this.redis.get(cacheKey);
    if (cachedUser) {
      return JSON.parse(cachedUser);
    }

    // 2. Fallback to PostgreSQL
    const user = await this.userModel.findByPk(userId, {
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
    await this.redis.set(cacheKey, JSON.stringify(profile), 600 * 60 * 100);

    return profile;
  }
}
