import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { MessagesModule } from 'src/modules/messages/messages.module';
import { ChatGateway } from './chat.gateway';
import { UsersService } from 'src/modules/users/users.service';
import { ConversationService } from 'src/modules/conversation/conversation.service';

@Module({
  imports: [MessagesModule, AuthModule],
  providers: [ChatGateway, UsersService, ConversationService],
  exports: [ChatGateway],
})
export class ChatGatewayModule {}
