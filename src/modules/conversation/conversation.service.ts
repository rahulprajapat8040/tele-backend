import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  Conversation,
  ConversationMember,
  Message,
  User,
} from '../database/models';
import { Sequelize } from 'sequelize-typescript';
import { IAuthUser } from 'src/lib/interfaces/user.interface';
import { CreatePrivateConversationDTO } from './dto/conversation.dto';
import { ConversationType, MemberRole } from 'src/lib/enum';
import { Op, UniqueConstraintError } from 'sequelize';
import { CommonQueryDTO } from 'src/common/dto/common-query.dto';
import {
  generatePagination,
  getPagination,
  responseSender,
} from 'src/lib/helper/function.helper';
import { RESPONSE_MESSAGE } from 'src/lib/constant/response-message.constant';
import { decryptUserPhone } from 'src/lib/helper/encryption.helper';
import { MessageReceipts } from '../database/models/message-receipts';
import { PresenceService } from '../presence/presence.service';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectModel(Conversation)
    private readonly conversationModel: typeof Conversation,
    @InjectModel(ConversationMember)
    private readonly conversationMemberModel: typeof ConversationMember,
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly presenceService: PresenceService,

    private readonly sequelize: Sequelize,
  ) {}

  async createPrivateConversation(
    user: IAuthUser,
    dto: CreatePrivateConversationDTO,
  ) {
    const currentUserId = user.id;
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
  async getMyConversations(query: CommonQueryDTO, user: IAuthUser) {
    const { page, limit, offset } = getPagination(query);

    const res = await this.conversationModel.findAndCountAll({
      limit,
      offset,
      attributes: ['id', 'title', 'createdAt'],
      include: [
        {
          model: this.conversationMemberModel,
          where: {
            userId: user.id,
            leftAt: null,
          },
          attributes: ['id', 'userId'],
          include: [
            {
              model: this.userModel,
              attributes: [
                'id',
                'firstName',
                'lastName',
                'countryCode',
                'phoneNo',
                'lastSeenAt',
              ],
            },
          ],
        },
        {
          model: Message,
          order: [['createdAt', 'DESC']],
          limit: 1,
          include: [
            {
              model: MessageReceipts,
              limit: 1,
              attributes: ['id', 'deliveredAt', 'readAt'],
            },
          ],
        },
      ],
    });

    const decryptedUser = decryptUserPhone(res);

    const conversationIds = decryptedUser.rows.map(
      (conversation: any) => conversation.id,
    );

    // Fetch other participants from all conversations
    const otherMembers = await this.conversationMemberModel.findAll({
      where: {
        conversationId: {
          [Op.in]: conversationIds,
        },
        userId: {
          [Op.ne]: user.id,
        },
        leftAt: null,
      },
      attributes: ['id', 'conversationId', 'userId'],
      include: [
        {
          model: this.userModel,
          attributes: [
            'id',
            'firstName',
            'lastName',
            'countryCode',
            'phoneNo',
            'lastSeenAt',
          ],
        },
      ],
    });

    // Get unique participant IDs
    const otherUserIds = [
      ...new Set(otherMembers.map((member: any) => member.userId)),
    ];

    // Fetch online users from presence service
    const onlineUserIds =
      await this.presenceService.getOnlineUsers(otherUserIds);
    const onlineSet = new Set(onlineUserIds);

    // Map conversationId -> other participant
    const otherMemberMap = new Map(
      otherMembers.map((member: any) => [member.conversationId, member]),
    );

    // Attach the other participant and their presence to each conversation
    const conversations = decryptedUser.rows.map((conversation: any) => {
      const otherMember = otherMemberMap.get(conversation.id);

      if (!otherMember) {
        return {
          ...conversation,
          members: [],
        };
      }

      const isOnline = onlineSet.has(otherMember.userId);
      const memberData =
        typeof otherMember.toJSON === 'function'
          ? otherMember.toJSON()
          : otherMember;

      const userData =
        typeof otherMember.user?.toJSON === 'function'
          ? otherMember.user.toJSON()
          : otherMember.user;

      return {
        ...conversation,
        members: [
          {
            ...memberData,
            user: {
              ...userData,
              isOnline,
              lastSeenAt: isOnline ? null : userData.lastSeenAt,
            },
          },
        ],
      };
    });

    const response = generatePagination(
      {
        rows: conversations,
        count: decryptedUser.count,
      },
      page,
      limit,
    );

    return responseSender(
      RESPONSE_MESSAGE.DATA_FETCHED,
      HttpStatus.OK,
      true,
      response,
    );
  }

  async getActiveConversationIds(userId: string): Promise<string[]> {
    const memberships = await this.conversationMemberModel.findAll({
      where: {
        userId,
        leftAt: null,
      },
      attributes: ['conversationId'],
      raw: true,
    });

    return memberships.map((member) => member.conversationId);
  }

  private generateDirectKey(user1: string, user2: string) {
    return [user1, user2].sort().join(':');
  }
}
