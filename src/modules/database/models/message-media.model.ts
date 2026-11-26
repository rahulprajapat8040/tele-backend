import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Index,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { MODEL_NAME } from 'src/lib/constant/model-name.constant';
import { Message } from './message.model';
import { Media } from './media.model';

@Table({
  tableName: MODEL_NAME.MESSAGE_MEDIA,
  paranoid: true,
  timestamps: true,
})
export class MessageMedia extends Model<MessageMedia, Partial<MessageMedia>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Message)
  @Index
  @Column(DataType.UUID)
  declare messageId: string;

  @ForeignKey(() => Media)
  @Index
  @Column(DataType.UUID)
  declare mediaId: string;

  @Default(0)
  @Column(DataType.INTEGER)
  declare position: number;

  @Column(DataType.STRING)
  declare caption: string | null;

  @BelongsTo(() => Message)
  declare message: Message;

  @BelongsTo(() => Media)
  declare media: Media;
}
