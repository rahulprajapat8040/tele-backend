import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
