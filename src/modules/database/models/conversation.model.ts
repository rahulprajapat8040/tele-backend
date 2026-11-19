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
import { ConversationType } from 'src/lib/enum';
import { ConversationMember } from './conversation-member.model';

@Table({
  tableName: MODEL_NAME.CONVERSATION,
  timestamps: true,
  paranoid: true,
  indexes: [
    {
      unique: true,
      fields: ['directKey'],
    },
  ],
})
export class Conversation extends Model<Conversation, Partial<Conversation>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column(DataType.ENUM(...Object.values(ConversationType)))
  declare type: ConversationType;

  @AllowNull
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull
  @Column(DataType.UUID)
  declare createdBy: string;

  @AllowNull
  @Column(DataType.STRING)
  declare directKey: string;

  @HasMany(() => ConversationMember)
  declare members: ConversationMember[];
}
