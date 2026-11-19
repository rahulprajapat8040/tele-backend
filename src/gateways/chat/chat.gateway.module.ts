import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { MessagesModule } from 'src/modules/messages/messages.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [MessagesModule, AuthModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatGatewayModule {}
