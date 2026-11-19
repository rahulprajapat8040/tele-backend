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
import { DeviceType } from 'src/lib/enum';
import { User } from './user.model';

@Table({ tableName: MODEL_NAME.DEVICE_INFO, timestamps: true, paranoid: true })
export class DeviceInfo extends Model<DeviceInfo, Partial<DeviceInfo>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column(DataType.STRING)
  declare deviceId: string;

  @Column(DataType.STRING(12))
  declare otp: string;

  @AllowNull
  @Column(DataType.STRING)
  declare deviceToken: string;

  @Column(DataType.TEXT)
  declare refreshHash: string;

  @Column(DataType.ENUM(...Object.values(DeviceType)))
  declare deviceType: DeviceType;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User, { onDelete: 'CASCADE' })
  declare user: User;
}
