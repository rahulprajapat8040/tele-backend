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
import { User } from './user.model';

@Table({
  tableName: MODEL_NAME.CONTACT,
  paranoid: true,
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['ownerUserId', 'phoneHash'],
    },
  ],
})
export class Contact extends Model<Contact, Partial<Contact>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull
  @Column(DataType.STRING)
  declare contactName: string;

  @Column(DataType.STRING(64))
  declare phoneHash: string;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare ownerUserId: string;

  @AllowNull
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare matchedUserId: string | null;

  @BelongsTo(() => User, 'ownerUserId')
  declare owner: User;

  @BelongsTo(() => User, 'matchedUserId')
  declare matchedUser: User;
}
