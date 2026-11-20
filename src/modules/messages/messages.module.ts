import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { UsersService } from '../users/users.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, UsersService],
  exports: [MessagesService],
})
export class MessagesModule {}
