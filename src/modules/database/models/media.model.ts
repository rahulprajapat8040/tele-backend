import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Index,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { MODEL_NAME } from 'src/lib/constant/model-name.constant';
import { MediaStatus, MediaType } from 'src/lib/enum';
import { MessageMedia } from './message-media.model';
import { User } from './user.model';

@Table({ tableName: MODEL_NAME.MEDIA, timestamps: true, paranoid: true })
export class Media extends Model<Media, Partial<Media>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column(DataType.STRING)
  declare originalName: string;

  @Column(DataType.STRING)
  declare mimeType: string;

  @Column(DataType.BIGINT)
  declare size: number;

  @Column(DataType.ENUM(...Object.values(MediaType)))
  declare mediaType: MediaType;

  @Index({ unique: true })
  @Column(DataType.TEXT)
  declare storageKey: string;

  @Column(DataType.STRING)
  declare bucket: string;

  @Default(MediaStatus.READY)
  @Column(DataType.ENUM(...Object.values(MediaStatus)))
  declare status: MediaStatus;

  @AllowNull
  @Column(DataType.TEXT)
  declare thumbnailKey: string | null;

  @AllowNull
  @Column(DataType.INTEGER)
  declare width: number | null;

  @AllowNull
  @Column(DataType.INTEGER)
  declare height: number | null;

  @AllowNull
  @Column(DataType.INTEGER)
  declare duration: number | null;

  @Index
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare uploadedById: string;

  @BelongsTo(() => User)
  declare uploader: User;

  @HasMany(() => MessageMedia)
  declare messageAttachments: MessageMedia[];
}
