import {
  AllowNull,
  Column,
  DataType,
  Default,
  HasMany,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { MODEL_NAME } from 'src/lib/constant/model-name.constant';
import { DeviceInfo } from './device-info.model';
import { Contact } from './contact.model';
import { DataTypes } from 'sequelize';
import { Media } from './media.model';

@Table({ tableName: MODEL_NAME.USER, paranoid: true, timestamps: true })
export class User extends Model<User, Partial<User>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column(DataType.STRING)
  declare firstName: string;

  @AllowNull
  @Column(DataType.STRING)
  declare lastName: string;

  @AllowNull
  @Column(DataType.TEXT)
  declare description: string;

  @Column(DataType.STRING)
  declare email: string;

  @AllowNull
  @Column(DataType.STRING)
  declare countryCode: string;

  @AllowNull
  @Column(DataType.STRING)
  declare phoneNo: string;

  @AllowNull
  @Column(DataType.STRING(64))
  declare phoneHash: string;

  @AllowNull
  @Column(DataType.STRING)
  declare userName: string;

  @AllowNull
  @Column(DataType.DATEONLY)
  declare dob: string;

  @AllowNull
  @Column(DataType.DATE)
  declare lastSeenAt: Date | null;

  @HasMany(() => DeviceInfo)
  declare devices: DeviceInfo[];

  @HasMany(() => Contact, 'ownerUserId')
  declare contacts: Contact[];

  @HasMany(() => Contact, 'matchedUserId')
  declare matchedContacts: Contact[];

  @HasMany(() => Media)
  declare uploadedMedia: Media[];
}
