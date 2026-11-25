import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { MODEL_NAME } from 'src/lib/constant/model-name.constant';
import { Conversation } from './conversation.model';
import { User } from './user.model';
import { MessageType } from 'src/lib/enum';
import { MessageReceipts } from './message-receipts';

@Table({
  tableName: MODEL_NAME.MESSAGE,
  timestamps: true,
  paranoid: true,
  indexes: [
    {
      fields: ['conversationId', 'createdAt', 'id'],
    },
    {
      unique: true,
      fields: ['senderId', 'clientMessageId'],
    },
  ],
})
export class Message extends Model<Message, Partial<Message>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column(DataType.UUID)
  declare clientMessageId: string;

  @Column(DataType.ENUM(...Object.values(MessageType)))
  declare type: MessageType;

  @AllowNull
  @Column(DataType.TEXT)
  declare content: string | null;

  @AllowNull
  @Column(DataType.UUID)
  declare replyToMessageId: string | null;

  @AllowNull
  @Column(DataType.DATE)
  declare editedAt: Date | null;

  @AllowNull
  @Column(DataType.DATE)
  declare deletedForAllAt: Date | null;

  @ForeignKey(() => Conversation)
  @Column(DataType.UUID)
  declare conversationId: string;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare senderId: string;

  @BelongsTo(() => Conversation)
  declare conversation: Conversation;

  @BelongsTo(() => User)
  declare sender: User;

  @HasMany(() => MessageReceipts)
  declare receipts: MessageReceipts[];

  @BelongsTo(() => Message, {
    foreignKey: 'replyToMessageId',
    as: 'replyTo',
  })
  declare replyTo: Message | null;

  @HasMany(() => Message, {
    foreignKey: 'replyToMessageId',
    as: 'replies',
  })
  declare replies: Message[];
}
