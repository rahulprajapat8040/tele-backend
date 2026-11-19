import {
  AllowNull,
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
import { User } from './user.model';
import { MemberRole } from 'src/lib/enum';

@Table({
  tableName: MODEL_NAME.CONVERSATION_MEMBER,
  timestamps: true,
  paranoid: true,
  indexes: [
    {
      unique: true,
      fields: ['conversationId', 'userId'],
    },
    {
      fields: ['userId', 'conversationId'],
    },
  ],
})
export class ConversationMember extends Model<
  ConversationMember,
  Partial<ConversationMember>
> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({
    type: DataType.ENUM(...Object.values(MemberRole)),
    defaultValue: MemberRole.MEMBER,
  })
  declare role: MemberRole;

  @AllowNull
  @Column(DataType.DATE)
  declare joinedAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  declare leftAt: Date | null;

  @AllowNull
  @Column(DataType.UUID)
  declare lastDeliveredMessageId: string;

  @AllowNull
  @Column(DataType.DATE)
  lastDeliveredAt: Date | null;

  @AllowNull
  @Column(DataType.UUID)
  declare lastReadMessageId: string;

  @AllowNull
  @Column(DataType.DATE)
  lastReadAt: Date | null;

  @ForeignKey(() => Conversation)
  @Column(DataType.UUID)
  declare conversationId: string;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @BelongsTo(() => Conversation)
  declare conversation: Conversation;
}
