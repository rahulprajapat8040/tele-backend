import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PresenceService {
  constructor(private readonly redis: RedisService) {}

  private readonly socketKey = (userId: string) => {
    return `chat:presence:${userId}:sockets`;
  };

  async addSocket(userId: string, socketId: string): Promise<boolean> {
    const key = this.socketKey(userId);

    const added = await this.redis.sadd(key, socketId);
    if (!added) return false;
    console.log('addedddd', added);

    const socketCount = await this.redis.scard(key);

    return socketCount === 1;
  }

  async removeSocket(userId: string, socketId: string): Promise<boolean> {
    const key = this.socketKey(userId);

    console.log('keeeyyyyy', key);

    const removed = await this.redis.srem(key, socketId);
    console.log('removed', removed);

    if (!removed) return false;

    const remainingSockets = await this.redis.scard(key);
    console.log('remaingggg socketttt', remainingSockets);
    return remainingSockets === 0;
  }

  async isOnline(userId: string): Promise<boolean> {
    const count = await this.redis.scard(this.socketKey(userId));

    return count > 0;
  }

  async getUserSockets(userId: string): Promise<string[]> {
    return this.redis.smembers(this.socketKey(userId));
  }

  async getOnlineUsers(userIds: string[]): Promise<string[]> {
    if (!userIds.length) return [];

    const keys = userIds.map((id) => this.socketKey(id));

    const counts = await this.redis.scardMany(keys);

    return userIds.filter((_, index) => counts[index] > 0);
  }
}
