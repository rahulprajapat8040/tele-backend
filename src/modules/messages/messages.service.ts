import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  Conversation,
  ConversationMember,
  Message,
  MessageHidden,
  User,
} from '../database/models';
import { IAuthUser } from 'src/lib/interfaces/user.interface';
import {
  DeleteMessageDTO,
  EditMessageDTO,
  MarkMessagesReadDTO,
  SendMessageDTO,
} from './dto/messages.dto';
import { MessageType } from 'src/lib/enum';
import { Op, UniqueConstraintError } from 'sequelize';
import { GetMessageHistoryDTO } from './dto/messages-query.dto';
import {
  decodeCursor,
  encodeCursor,
  responseSender,
} from 'src/lib/helper/function.helper';
import { RESPONSE_MESSAGE } from 'src/lib/constant/response-message.constant';
import { Sequelize } from 'sequelize-typescript';
import { MessageReceipts } from '../database/models/message-receipts';
import { UsersService } from '../users/users.service';

@Injectable()
export class MessagesService {
  private readonly replyToInclude = {
    model: Message,
    as: 'replyTo',
    attributes: ['id', 'content', 'senderId', 'type', 'deletedAt'],
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName'],
      },
    ],
  };

  constructor(
    @InjectModel(Message)
    private readonly messageModel: typeof Message,
    @InjectModel(Conversation)
    private readonly conversationModel: typeof Conversation,
    @InjectModel(ConversationMember)
    private readonly conversationMemberModel: typeof ConversationMember,
    @InjectModel(MessageReceipts)
    private readonly messageReceiptModel: typeof MessageReceipts,
    @InjectModel(MessageHidden)
    private readonly messageHiddenModel: typeof MessageHidden,
    private readonly usersService: UsersService,
    private readonly sequelize: Sequelize,
  ) {}

  async sendMessage(user: IAuthUser, dto: SendMessageDTO) {
    const senderId = user.id;
    const content = dto.content?.trim() ?? null;
    // 1. Validate message content.
    if (dto.type === MessageType.TEXT && !dto.content?.trim()) {
      throw new BadRequestException('Message cannot be empty');
    }

    // 2. Check conversation.
    const conversation = await this.conversationModel.findByPk(
      dto.conversationId,
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // 3. Check membership.
    const membership = await this.conversationMemberModel.findOne({
      where: {
        conversationId: dto.conversationId,
        userId: senderId,
        leftAt: null,
      },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You are not allowed to send messages in this conversation',
      );
    }

    // 4. Check whether message was already submitted.
    const existingMessage = await this.messageModel.findOne({
      where: {
        senderId,
        clientMessageId: dto.clientMessageId,
      },
    });

    if (existingMessage) {
      this.validateDuplicateMessage(existingMessage, dto, content);
      const hydratedMessage = await this.messageModel.findByPk(
        existingMessage.id,
        {
          include: [
            { model: User, as: 'sender', attributes: ['id', 'firstName'] },
            this.replyToInclude,
          ],
        },
      );

      return responseSender(RESPONSE_MESSAGE.DATA_ADDED, HttpStatus.OK, true, {
        ...hydratedMessage!.toJSON(),
        receipts: [],
      });
    }

    if (dto.replyToMessageId) {
      const replyToMessage = await Message.findOne({
        where: {
          id: dto.replyToMessageId,
          conversationId: dto.conversationId,
        },
      });

      if (!replyToMessage) {
        throw new NotFoundException(
          'Reply message not found in this conversation',
        );
      }
    }

    try {
      const message = await this.sequelize.transaction(async (transaction) => {
        const newMessage = await this.messageModel.create(
          {
            conversationId: dto.conversationId,
            senderId,
            clientMessageId: dto.clientMessageId,
            type: dto.type,
            content: content ?? null,
            replyToMessageId: dto.replyToMessageId ?? null,
          },
          { transaction },
        );

        const recipients = await this.getRecipientUserIds(
          conversation.id,
          user.id,
        );

        if (recipients.length > 0) {
          await this.messageReceiptModel.bulkCreate(
            recipients.map((recipient) => ({
              messageId: newMessage.id,
              userId: recipient,
              deliveredAt: null,
              readAt: null,
            })),
            { transaction },
          );
        }
        return newMessage;
      });

      const hydratedMessage = await this.messageModel.findByPk(message.id, {
        include: [
          { model: User, as: 'sender', attributes: ['id', 'firstName'] },
          this.replyToInclude,
        ],
      });

      const response = {
        ...hydratedMessage!.toJSON(),
        receipts: [],
      };

      return responseSender(
        RESPONSE_MESSAGE.DATA_ADDED,
        HttpStatus.OK,
        true,
        response,
      );
    } catch (error) {
      // Handles simultaneous retry requests.
      if (error instanceof UniqueConstraintError) {
        const existing = await this.messageModel.findOne({
          where: {
            senderId,
            clientMessageId: dto.clientMessageId,
          },
        });

        if (existing) {
          this.validateDuplicateMessage(existing, dto, content);

          const hydratedMessage = await this.messageModel.findByPk(
            existing.id,
            {
              include: [
                { model: User, as: 'sender', attributes: ['id', 'firstName'] },
                this.replyToInclude,
              ],
            },
          );

          return responseSender(
            RESPONSE_MESSAGE.DATA_ADDED,
            HttpStatus.OK,
            true,
            {
              ...hydratedMessage!.toJSON(),
              receipts: [],
            },
          );
        }
      }

      throw error;
    }
  }

  async markAsDelivered(
    user: IAuthUser,
    conversationId: string,
    lastDeliveredMessageId: string,
  ) {
    return this.sequelize.transaction(async (transaction) => {
      // 1. Verify membership
      const membership = await this.conversationMemberModel.findOne({
        where: {
          conversationId,
          userId: user.id,
          leftAt: null,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!membership) {
        throw new ForbiddenException(
          'You are not a member of this conversation',
        );
      }

      // 2. Find acknowledged message
      const targetMessage = await this.messageModel.findOne({
        where: {
          id: lastDeliveredMessageId,
          conversationId,
          senderId: {
            [Op.ne]: user.id,
          },
        },
        transaction,
      });

      if (!targetMessage) {
        throw new NotFoundException('Message not found');
      }

      // 3. Check if delivery cursor should advance
      let shouldUpdateCursor = true;

      if (membership.lastDeliveredMessageId) {
        const currentMessage = await this.messageModel.findOne({
          where: {
            id: membership.lastDeliveredMessageId,
            conversationId,
          },
          transaction,
        });

        if (currentMessage) {
          const targetIsOlder =
            targetMessage.createdAt < currentMessage.createdAt ||
            (targetMessage.createdAt.getTime() ===
              currentMessage.createdAt.getTime() &&
              targetMessage.id <= currentMessage.id);

          if (targetIsOlder) {
            shouldUpdateCursor = false;
          }
        }
      }

      const now = new Date();

      // 4. Find incoming messages up to the acknowledged cursor
      const messages = await this.messageModel.findAll({
        attributes: ['id', 'senderId'],
        where: {
          conversationId,
          senderId: {
            [Op.ne]: user.id,
          },
          [Op.or]: [
            {
              createdAt: {
                [Op.lt]: targetMessage.createdAt,
              },
            },
            {
              createdAt: targetMessage.createdAt,
              id: {
                [Op.lte]: targetMessage.id,
              },
            },
          ],
        },
        transaction,
      });

      const messageIds = messages.map((message) => message.id);

      // 5. Update only pending receipts
      let updatedCount = 0;
      let updatedMessageIds: string[] = [];

      if (messageIds.length) {
        const [count, updatedReceipts] = await this.messageReceiptModel.update(
          {
            deliveredAt: now,
          },
          {
            where: {
              userId: user.id,
              messageId: {
                [Op.in]: messageIds,
              },
              deliveredAt: null,
            },
            transaction,
            returning: true,
          },
        );

        updatedCount = count;

        // Only messages whose receipts actually changed
        updatedMessageIds = updatedReceipts.map((receipt) => receipt.messageId);
      }

      // 6. Advance cursor only if newer
      if (shouldUpdateCursor) {
        await membership.update(
          {
            lastDeliveredMessageId: targetMessage.id,
            lastDeliveredAt: now,
          },
          { transaction },
        );
      }

      // 7. Determine actual senders for changed receipts
      const updatedMessages = updatedMessageIds.length
        ? await this.messageModel.findAll({
            attributes: ['id', 'senderId'],
            where: {
              id: {
                [Op.in]: updatedMessageIds,
              },
            },
            transaction,
          })
        : [];

      const senderIds = [
        ...new Set(
          updatedMessages
            .map((message) => message.senderId)
            .filter((senderId) => senderId !== user.id),
        ),
      ];

      // 8. Return delivery result
      return responseSender(
        RESPONSE_MESSAGE.DATA_UPDATED,
        HttpStatus.OK,
        true,
        {
          conversationId,
          lastDeliveredMessageId: membership.lastDeliveredMessageId,
          lastDeliveredAt: membership.lastDeliveredAt,
          updatedReceipts: updatedCount,
          updatedMessageIds,
          senderIds,
          deliveredAt: now,
        },
      );
    });
  }

  async getMessageHistory(
    user: IAuthUser,
    conversationId: string,
    query: GetMessageHistoryDTO,
  ) {
    const { limit = 30, before } = query;

    const membership = await this.conversationMemberModel.findOne({
      where: { conversationId, userId: user.id, leftAt: null },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const hiddenMessages = await this.messageHiddenModel.findAll({
      attributes: ['messageId'],
      where: {
        conversationId,
        userId: user.id,
      },
      raw: true,
    });

    const hiddenIds = hiddenMessages.map((entry) => entry.messageId);

    const where: any = { conversationId };

    if (hiddenIds.length) {
      where.id = { [Op.notIn]: hiddenIds };
    }

    if (before) {
      const cursor = decodeCursor(before);

      if (
        !cursor?.id ||
        !cursor?.createdAt ||
        Number.isNaN(Date.parse(cursor.createdAt))
      ) {
        throw new BadRequestException('Invalid pagination cursor');
      }

      where[Op.or] = [
        {
          createdAt: {
            [Op.lt]: new Date(cursor.createdAt),
          },
        },
        {
          [Op.and]: [
            { createdAt: new Date(cursor.createdAt) },
            { id: { [Op.lt]: cursor.id } },
          ],
        },
      ];
    }

    const messages = await this.messageModel.findAll({
      where,
      include: [
        { model: User, as: 'sender', attributes: ['id', 'firstName'] },
        this.replyToInclude,
        {
          model: this.messageReceiptModel,
          as: 'receipts',
          attributes: ['userId', 'deliveredAt', 'readAt'],
        },
      ],
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: limit + 1,
    });

    // 4. Determine whether more messages exist
    const hasMore = messages.length > limit;

    const result = messages.slice(0, limit);

    // 5. Reverse to chronological order
    result.reverse();

    const oldestMessage = result[0];

    const nextCursor =
      hasMore && oldestMessage
        ? encodeCursor({
            id: oldestMessage.id,
            createdAt: oldestMessage.createdAt,
          })
        : null;

    return responseSender(RESPONSE_MESSAGE.DATA_FETCHED, HttpStatus.OK, true, {
      data: result,
      pagination: {
        limit,
        hasMore,
        nextCursor,
      },
    });
  }

  async markMessagesAsRead(
    user: IAuthUser,
    conversationId: string,
    dto: MarkMessagesReadDTO,
  ) {
    return this.sequelize.transaction(async (transaction) => {
      const membership = await this.conversationMemberModel.findOne({
        where: {
          conversationId,
          userId: user.id,
          leftAt: null,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!membership) {
        throw new ForbiddenException('Conversation access denied');
      }

      const targetMessage = await this.messageModel.findOne({
        where: {
          id: dto.lastReadMessageId,
          conversationId,
          senderId: {
            [Op.ne]: user.id,
          },
        },
        transaction,
      });

      if (!targetMessage) {
        throw new NotFoundException('Message not found');
      }

      // Compare message ordering
      const isMessageAhead = (
        target: Message,
        current: Message | null,
      ): boolean => {
        if (!current) return true;

        const targetTime = target.createdAt.getTime();
        const currentTime = current.createdAt.getTime();

        return (
          targetTime > currentTime ||
          (targetTime === currentTime && target.id > current.id)
        );
      };

      let shouldUpdateReadCursor = true;

      if (membership.lastReadMessageId) {
        const currentReadMessage = await this.messageModel.findOne({
          where: {
            id: membership.lastReadMessageId,
            conversationId,
          },
          transaction,
        });

        shouldUpdateReadCursor = isMessageAhead(
          targetMessage,
          currentReadMessage,
        );
      }

      let shouldUpdateDeliveredCursor = true;

      if (membership.lastDeliveredMessageId) {
        const currentDeliveredMessage = await this.messageModel.findOne({
          where: {
            id: membership.lastDeliveredMessageId,
            conversationId,
          },
          transaction,
        });

        shouldUpdateDeliveredCursor = isMessageAhead(
          targetMessage,
          currentDeliveredMessage,
        );
      }

      const now = new Date();

      // Fetch incoming messages up to the target message.
      const messages = await this.messageModel.findAll({
        attributes: ['id', 'senderId'],
        where: {
          conversationId,
          senderId: {
            [Op.ne]: user.id,
          },
          [Op.or]: [
            {
              createdAt: {
                [Op.lt]: targetMessage.createdAt,
              },
            },
            {
              createdAt: targetMessage.createdAt,
              id: {
                [Op.lte]: targetMessage.id,
              },
            },
          ],
        },
        transaction,
      });

      const messageIds = messages.map((message) => message.id);

      let updatedMessageIds: string[] = [];

      // Map changed message receipts to their original senders.
      const senderMessageMap: Record<string, string[]> = {};

      if (messageIds.length > 0) {
        // Find receipts that have not been read yet.
        const unreadReceipts = await this.messageReceiptModel.findAll({
          attributes: ['messageId'],
          where: {
            userId: user.id,
            messageId: {
              [Op.in]: messageIds,
            },
            readAt: null,
          },
          transaction,
        });

        updatedMessageIds = unreadReceipts.map((receipt) => receipt.messageId);

        const updatedMessageSet = new Set(updatedMessageIds);

        // Group updated receipt message IDs by sender.
        for (const message of messages) {
          if (!updatedMessageSet.has(message.id)) continue;

          const senderId = message.senderId;

          if (!senderMessageMap[senderId]) {
            senderMessageMap[senderId] = [];
          }

          senderMessageMap[senderId].push(message.id);
        }

        // Reading implies delivery.
        await this.messageReceiptModel.update(
          {
            deliveredAt: now,
          },
          {
            where: {
              userId: user.id,
              messageId: {
                [Op.in]: messageIds,
              },
              deliveredAt: null,
            },
            transaction,
          },
        );

        // Mark unread receipts as read.
        if (updatedMessageIds.length > 0) {
          await this.messageReceiptModel.update(
            {
              readAt: now,
            },
            {
              where: {
                userId: user.id,
                messageId: {
                  [Op.in]: updatedMessageIds,
                },
                readAt: null,
              },
              transaction,
            },
          );
        }
      }

      // Update conversation member cursors.
      const membershipUpdate: Partial<ConversationMember> = {};

      if (shouldUpdateReadCursor) {
        membershipUpdate.lastReadMessageId = targetMessage.id;
        membershipUpdate.lastReadAt = now;
      }

      // Reading also means delivered. Never move the cursor backwards.
      if (shouldUpdateDeliveredCursor) {
        membershipUpdate.lastDeliveredMessageId = targetMessage.id;
        membershipUpdate.lastDeliveredAt = now;
      }

      if (Object.keys(membershipUpdate).length > 0) {
        await membership.update(membershipUpdate, {
          transaction,
        });
      }

      return responseSender(
        RESPONSE_MESSAGE.DATA_UPDATED,
        HttpStatus.OK,
        true,
        {
          conversationId,

          lastReadMessageId: shouldUpdateReadCursor
            ? targetMessage.id
            : membership.lastReadMessageId,

          lastReadAt: shouldUpdateReadCursor ? now : membership.lastReadAt,

          lastDeliveredMessageId: shouldUpdateDeliveredCursor
            ? targetMessage.id
            : membership.lastDeliveredMessageId,

          lastDeliveredAt: shouldUpdateDeliveredCursor
            ? now
            : membership.lastDeliveredAt,

          updatedMessageIds,
          senderMessageMap,
          readAt: now,
          updatedReceipts: updatedMessageIds.length,
        },
      );
    });
  }

  async deleteMessage(user: IAuthUser, dto: DeleteMessageDTO) {
    const membership = await this.conversationMemberModel.findOne({
      where: {
        conversationId: dto.conversationId,
        userId: user.id,
        leftAt: null,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You are not a member of this conversation',
      );
    }

    const message = await this.messageModel.findOne({
      where: {
        id: dto.messageId,
        conversationId: dto.conversationId,
      },
      paranoid: false,
    });

    if (!message || message.deletedAt) {
      throw new NotFoundException('Message not found');
    }

    if (dto.forEveryone) {
      const deleteWindowMs = 48 * 60 * 60 * 1000;
      const age = Date.now() - new Date(message.createdAt).getTime();

      if (age > deleteWindowMs) {
        throw new BadRequestException(
          'Messages older than 48 hours cannot be deleted for everyone',
        );
      }

      await message.destroy();

      return responseSender(RESPONSE_MESSAGE.DATA_UPDATED, HttpStatus.OK, true, {
        scope: 'all',
        conversationId: dto.conversationId,
        messageId: dto.messageId,
      });
    }

    await this.messageHiddenModel.findOrCreate({
      where: {
        messageId: dto.messageId,
        userId: user.id,
      },
      defaults: {
        messageId: dto.messageId,
        userId: user.id,
        conversationId: dto.conversationId,
      },
    });

    return responseSender(RESPONSE_MESSAGE.DATA_UPDATED, HttpStatus.OK, true, {
      scope: 'me',
      conversationId: dto.conversationId,
      messageId: dto.messageId,
      userId: user.id,
    });
  }

  async editMessage(user: IAuthUser, dto: EditMessageDTO) {
    const content = dto.content?.trim();

    if (!content) {
      throw new BadRequestException('Message cannot be empty');
    }

    const message = await this.messageModel.findOne({
      where: {
        id: dto.messageId,
        conversationId: dto.conversationId,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== user.id) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    if (message.type !== MessageType.TEXT) {
      throw new BadRequestException('Only text messages can be edited');
    }

    const createdAt = new Date(message.createdAt).getTime();
    const editWindowMs = 24 * 60 * 60 * 1000;

    if (Date.now() - createdAt > editWindowMs) {
      throw new BadRequestException(
        'Messages older than 24 hours cannot be edited',
      );
    }

    const membership = await this.conversationMemberModel.findOne({
      where: {
        conversationId: dto.conversationId,
        userId: user.id,
        leftAt: null,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You are not allowed to edit messages in this conversation',
      );
    }

    if (message.content === content) {
      const unchanged = await this.messageModel.findByPk(message.id, {
        include: [
          { model: User, as: 'sender', attributes: ['id', 'firstName'] },
          this.replyToInclude,
        ],
      });

      return responseSender(
        RESPONSE_MESSAGE.DATA_UPDATED,
        HttpStatus.OK,
        true,
        unchanged!.toJSON(),
      );
    }

    const editedAt = new Date();

    await message.update({
      content,
      editedAt,
    });

    const hydratedMessage = await this.messageModel.findByPk(message.id, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'firstName'] },
        this.replyToInclude,
      ],
    });

    return responseSender(
      RESPONSE_MESSAGE.DATA_UPDATED,
      HttpStatus.OK,
      true,
      hydratedMessage!.toJSON(),
    );
  }

  async getRecipientUserIds(conversationId: string, senderId: string) {
    const members = await this.conversationMemberModel.findAll({
      attributes: ['userId'],
      where: {
        conversationId,
        userId: {
          [Op.ne]: senderId,
        },
        leftAt: null,
      },
    });

    return members.map((member) => member.userId);
  }

  async isConversationMember(
    userId: string,
    conversationId: string,
  ): Promise<boolean> {
    const membership = await this.conversationMemberModel.findOne({
      attributes: ['id'],
      where: {
        userId,
        conversationId,
        leftAt: null,
      },
    });

    return !!membership;
  }

  async findMessageById(messageId: string, conversationId: string) {
    const message = await this.messageModel.findOne({
      where: {
        id: messageId,
        conversationId,
      },
      attributes: ['id', 'senderId', 'conversationId'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  async getPendingDeliveryMessages(userId: string) {
    // 1. Get the user's active conversations
    const memberships = await this.conversationMemberModel.findAll({
      attributes: ['conversationId'],
      where: {
        userId,
        leftAt: null,
      },
      raw: true,
    });

    const conversationIds = memberships.map((item) => item.conversationId);

    if (!conversationIds.length) {
      return [];
    }

    // 2. Get messages that have not been delivered to this user
    const messages = await this.messageModel.findAll({
      where: {
        conversationId: {
          [Op.in]: conversationIds,
        },
        senderId: {
          [Op.ne]: userId,
        },
      },
      include: [
        {
          model: this.messageReceiptModel,
          as: 'receipts',
          required: true,
          where: {
            userId,
            deliveredAt: null,
          },
          attributes: ['userId', 'deliveredAt', 'readAt'],
        },
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName'],
        },
        this.replyToInclude,
      ],
      order: [
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    return messages;
  }

  private validateDuplicateMessage(
    existing: Message,
    dto: SendMessageDTO,
    content: string | null,
  ) {
    if (
      existing.conversationId !== dto.conversationId ||
      existing.type !== dto.type ||
      existing.content !== content ||
      (existing.replyToMessageId ?? null) !== (dto.replyToMessageId ?? null)
    ) {
      throw new ConflictException(
        'clientMessageId has already been used for another message',
      );
    }
  }
}
