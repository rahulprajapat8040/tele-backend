import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { MODEL_NAME } from 'src/lib/constant/model-name.constant';
import { Conversation } from './conversation.model';
import { Message } from './message.model';
import { User } from './user.model';

@Table({
  tableName: MODEL_NAME.MESSAGE_HIDDEN,
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['messageId', 'userId'],
    },
    {
      fields: ['conversationId', 'userId'],
    },
  ],
})
export class MessageHidden extends Model<
  MessageHidden,
  Partial<MessageHidden>
> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Message)
  @Column(DataType.UUID)
  declare messageId: string;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @ForeignKey(() => Conversation)
  @Column(DataType.UUID)
  declare conversationId: string;

  @BelongsTo(() => Message)
  declare message: Message;

  @BelongsTo(() => User)
  declare user: User;

  @BelongsTo(() => Conversation)
  declare conversation: Conversation;
}