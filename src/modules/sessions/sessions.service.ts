import { Inject, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.provider';

interface CreateSessionDto {
  userId: string;
  deviceId: string;
  deviceType: string;
  sessionId: string;
  expiresIn: number;
}

@Injectable()
export class SessionsService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private sessionKey(sessionId: string) {
    return `auth:session:${sessionId}`;
  }

  private userSessionsKey(userId: string) {
    return `user:sessions:${userId}`;
  }

  async createSession(dto: CreateSessionDto) {
    const { userId, deviceId, deviceType, sessionId, expiresIn } = dto;

    const session = {
      userId,
      deviceId,
      deviceType,
      sessionId,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const pipeline = this.redis.pipeline();

    pipeline.set(
      this.sessionKey(sessionId),
      JSON.stringify(session),
      'EX',
      expiresIn,
    );

    pipeline.sadd(this.userSessionsKey(userId), sessionId);

    // Keep the index alive slightly longer than the session.
    pipeline.expire(this.userSessionsKey(userId), expiresIn + 86400);

    await pipeline.exec();

    return session;
  }

  async getSession(sessionId: string) {
    const session = await this.redis.get(this.sessionKey(sessionId));

    if (!session) return null;

    return JSON.parse(session);
  }

  async isSessionValid(sessionId: string, userId: string) {
    const session = await this.getSession(sessionId);

    if (!session) return false;

    return session.isActive && session.userId === userId;
  }

  async revokeSession(sessionId: string, userId: string) {
    const session = await this.getSession(sessionId);

    if (!session || session.userId !== userId) {
      return false;
    }

    const pipeline = this.redis.pipeline();

    pipeline.del(this.sessionKey(sessionId));

    pipeline.srem(this.userSessionsKey(userId), sessionId);

    await pipeline.exec();

    return true;
  }

  async revokeAllSessions(userId: string) {
    const sessionsKey = this.userSessionsKey(userId);

    const sessionIds = await this.redis.smembers(sessionsKey);

    const pipeline = this.redis.pipeline();

    for (const sessionId of sessionIds) {
      pipeline.del(this.sessionKey(sessionId));
    }

    pipeline.del(sessionsKey);

    await pipeline.exec();

    return sessionIds;
  }

  async getUserSessions(userId: string) {
    const sessionIds = await this.redis.smembers(this.userSessionsKey(userId));

    if (!sessionIds.length) return [];

    const sessions = await this.redis.mget(
      ...sessionIds.map((id) => this.sessionKey(id)),
    );

    return sessions.filter(Boolean).map((session) => JSON.parse(session!));
  }
}
