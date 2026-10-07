import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { Modules } from './modules';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [DatabaseModule, ...Modules, RedisModule],
})
export class AppModule {}
