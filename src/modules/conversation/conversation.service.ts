import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Conversation, ConversationMember, User } from '../database/models';
import { Sequelize } from 'sequelize-typescript';
import { IAuthUser } from 'src/lib/interfaces/user.interface';
import { CreatePrivateConversationDTO } from './dto/conversation.dto';
import { ConversationType, MemberRole } from 'src/lib/enum';
import { UniqueConstraintError } from 'sequelize';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectModel(Conversation)
    private readonly conversationModel: typeof Conversation,
    @InjectModel(ConversationMember)
    private readonly conversationMemberModel: typeof ConversationMember,
    @InjectModel(User) private readonly userModel: typeof User,

    private readonly sequelize: Sequelize,
  ) {}

  async createPrivateConversation(
    user: IAuthUser,
    dto: CreatePrivateConversationDTO,
  ) {
    const currentUserId = user.userId;
    const targetUserId = dto.userId;

    if (currentUserId === targetUserId) {
      throw new BadRequestException(
        'You cannot create a conversation with yourself',
      );
    }

    const targetUser = await this.userModel.findByPk(targetUserId, {
      attributes: ['id', 'firstName', 'lastName', 'userName'],
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const directKey = this.generateDirectKey(currentUserId, targetUserId);

    const existingConversation = await this.conversationModel.findOne({
      where: { directKey, type: ConversationType.PRIVATE },
      include: [
        {
          model: this.conversationMemberModel,
          as: 'members',
          include: [
            {
              model: this.userModel,
              attributes: ['id', 'firstName', 'lastName', 'userName'],
            },
          ],
        },
      ],
    });

    if (existingConversation) {
      return existingConversation;
    }

    try {
      const conversation = await this.sequelize.transaction(
        async (transaction) => {
          const newConversation = await this.conversationModel.create(
            {
              type: ConversationType.PRIVATE,
              directKey,
              createdBy: currentUserId,
            },
            { transaction },
          );

          await this.conversationMemberModel.bulkCreate(
            [
              {
                conversationId: newConversation.id,
                userId: currentUserId,
                role: MemberRole.MEMBER,
                joinedAt: new Date(),
              },
              {
                conversationId: newConversation.id,
                userId: targetUserId,
                role: MemberRole.MEMBER,
                joinedAt: new Date(),
              },
            ],
            { transaction },
          );

          return newConversation;
        },
      );
      this.logger.log(`Private conversation created: ${conversation.id}`);

      return await this.conversationModel.findByPk(conversation.id, {
        include: [
          {
            model: ConversationMember,
            as: 'members',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'userName'],
              },
            ],
          },
        ],
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        const conversation = await this.conversationModel.findOne({
          where: { directKey },
          include: [
            {
              model: ConversationMember,
              as: 'members',
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['id', 'firstName', 'lastName', 'userName'],
                },
              ],
            },
          ],
        });

        if (conversation) {
          return conversation;
        }
      }
      throw error;
    }
  }

  private generateDirectKey(user1: string, user2: string) {
    return [user1, user2].sort().join(':');
  }
}
