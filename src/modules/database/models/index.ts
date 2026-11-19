import { Contact } from './contact.model';
import { ConversationMember } from './conversation-member.model';
import { Conversation } from './conversation.model';
import { DeviceInfo } from './device-info.model';
import { MessageReceipts } from './message-receipts';
import { Message } from './message.model';
import { User } from './user.model';

export { DeviceInfo, User, Contact, Conversation, ConversationMember, Message };

export const models = [
  DeviceInfo,
  User,
  Contact,
  Conversation,
  ConversationMember,
  Message,
  MessageReceipts,
];
