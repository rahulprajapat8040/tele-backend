import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { Modules } from './modules';

@Module({
  imports: [DatabaseModule, ...Modules],
})
export class AppModule {}
