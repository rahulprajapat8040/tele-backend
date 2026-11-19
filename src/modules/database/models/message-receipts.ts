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
import { Message } from './message.model';
import { User } from './user.model';

@Table({
  tableName: MODEL_NAME.MESSAGE_RECEIPTS,
  paranoid: true,
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['messageId', 'userId'],
    },
  ],
})
export class MessageReceipts extends Model<
  MessageReceipts,
  Partial<MessageReceipts>
> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column(DataType.DATE)
  declare deliveredAt: Date | null;

  @Column(DataType.DATE)
  declare readAt: Date | null;

  @ForeignKey(() => Message)
  @Column(DataType.UUID)
  declare messageId: string;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => Message)
  declare message: Message;

  @BelongsTo(() => User)
  declare user: User;
}
