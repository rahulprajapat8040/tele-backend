import { Contact } from './contact.model';
import { ConversationMember } from './conversation-member.model';
import { Conversation } from './conversation.model';
import { DeviceInfo } from './device-info.model';
import { MessageReceipts } from './message-receipts';
import { MessageHidden } from './message-hidden.model';
import { Message } from './message.model';
import { User } from './user.model';
import { Media } from './media.model';
import { MessageMedia } from './message-media.model';

export {
  DeviceInfo,
  User,
  Contact,
  Conversation,
  ConversationMember,
  Message,
  MessageHidden,
  Media,
  MessageMedia,
};

export const models = [
  DeviceInfo,
  User,
  Contact,
  Conversation,
  ConversationMember,
  Message,
  MessageReceipts,
  MessageHidden,
  Media,
  MessageMedia,
];
