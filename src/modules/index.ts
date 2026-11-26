import { ChatGatewayModule } from 'src/gateways/chat/chat.gateway.module';
import { AuthModule } from './auth/auth.module';
import { ContactsModule } from './contacts/contacts.module';
import { ConversationModule } from './conversation/conversation.module';
import { DatabaseModule } from './database/database.module';
import { MessagesModule } from './messages/messages.module';
import { RedisModule } from './redis/redis.module';
import { SessionsModule } from './sessions/sessions.module';
import { persenceModule } from './presence/presence.module';
import { MediaModule } from './media/media.module';

export const modules = [
  RedisModule,
  DatabaseModule,
  AuthModule,
  SessionsModule,
  ContactsModule,
  ConversationModule,
  MessagesModule,
  ChatGatewayModule,
  persenceModule,
  MediaModule,
];
