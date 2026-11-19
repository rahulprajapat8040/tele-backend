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
  User,
} from '../database/models';
import { IAuthUser } from 'src/lib/interfaces/user.interface';
import { MarkMessagesReadDTO, SendMessageDTO } from './dto/messages.dto';
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

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message)
    private readonly messageModel: typeof Message,
    @InjectModel(Conversation)
    private readonly conversationModel: typeof Conversation,
    @InjectModel(ConversationMember)
    private readonly conversationMemberModel: typeof ConversationMember,
    @InjectModel(MessageReceipts)
    private readonly messageReceiptModel: typeof MessageReceipts,
    private readonly sequelize: Sequelize,
  ) {}

  async sendMessage(user: IAuthUser, dto: SendMessageDTO) {
    const senderId = user.userId;
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
      return existingMessage;
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
          },
          { transaction },
        );

        const recipients = await this.getRecipientUserIds(
          conversation.id,
          user.userId,
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
      return responseSender(
        RESPONSE_MESSAGE.DATA_ADDED,
        HttpStatus.OK,
        true,
        message,
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
          return existing;
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
      // 1. Verify membership and lock the membership row
      const membership = await this.conversationMemberModel.findOne({
        where: {
          conversationId,
          userId: user.userId,
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

      // 2. Find the acknowledged message
      const targetMessage = await this.messageModel.findOne({
        where: {
          id: lastDeliveredMessageId,
          conversationId,
          senderId: {
            [Op.ne]: user.userId,
          },
        },
        transaction,
      });

      if (!targetMessage) {
        throw new NotFoundException('Message not found');
      }

      // 3. Determine whether the delivery cursor should advance
      let shouldUpdate = true;

      if (membership.lastDeliveredMessageId) {
        const currentMessage = await this.messageModel.findOne({
          where: {
            id: membership.lastDeliveredMessageId,
            conversationId,
          },
          transaction,
        });

        if (currentMessage) {
          const currentTime = currentMessage.createdAt.getTime();
          const targetTime = targetMessage.createdAt.getTime();

          if (
            targetTime < currentTime ||
            (targetTime === currentTime &&
              targetMessage.id <= currentMessage.id)
          ) {
            shouldUpdate = false;
          }
        }
      }

      const now = new Date();

      // 4. Find all incoming messages up to the acknowledged message
      const messages = await this.messageModel.findAll({
        attributes: ['id'],
        where: {
          conversationId,
          senderId: {
            [Op.ne]: user.userId,
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

      // 5. Update individual message delivery receipts
      if (messageIds.length > 0) {
        await this.messageReceiptModel.update(
          {
            deliveredAt: now,
          },
          {
            where: {
              userId: user.userId,
              messageId: {
                [Op.in]: messageIds,
              },
              deliveredAt: null,
            },
            transaction,
          },
        );
      }

      // 6. Update conversation delivery cursor
      if (shouldUpdate) {
        await membership.update(
          {
            lastDeliveredMessageId: targetMessage.id,
            lastDeliveredAt: now,
          },
          { transaction },
        );
      }

      // 7. Return updated delivery information
      return responseSender(
        RESPONSE_MESSAGE.DATA_UPDATED,
        HttpStatus.OK,
        true,
        {
          lastDeliveredMessageId: membership.lastDeliveredMessageId,
          lastDeliveredAt: membership.lastDeliveredAt,
          updatedReceipts: messageIds.length,
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
      where: { conversationId, userId: user.userId, leftAt: null },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const where: any = { conversationId };

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
          userId: user.userId,
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
            [Op.ne]: user.userId,
          },
        },
        transaction,
      });

      if (!targetMessage) {
        throw new NotFoundException('Message not found');
      }

      // Helper: Compare message ordering
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

      const messages = await this.messageModel.findAll({
        attributes: ['id'],
        where: {
          conversationId,
          senderId: {
            [Op.ne]: user.userId,
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

      // Preserve existing delivery timestamps.
      if (messageIds.length > 0) {
        await this.messageReceiptModel.update(
          {
            deliveredAt: now,
          },
          {
            where: {
              userId: user.userId,
              messageId: {
                [Op.in]: messageIds,
              },
              deliveredAt: null,
            },
            transaction,
          },
        );

        // Preserve existing read timestamps.
        await this.messageReceiptModel.update(
          {
            readAt: now,
          },
          {
            where: {
              userId: user.userId,
              messageId: {
                [Op.in]: messageIds,
              },
              readAt: null,
            },
            transaction,
          },
        );
      }

      const membershipUpdate: Partial<ConversationMember> = {};

      if (shouldUpdateReadCursor) {
        membershipUpdate.lastReadMessageId = targetMessage.id;
        membershipUpdate.lastReadAt = now;
      }

      // Reading implies delivery, but never move it backwards.
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
          lastReadMessageId: membership.lastReadMessageId,
          lastReadAt: membership.lastReadAt,

          lastDeliveredMessageId: membership.lastDeliveredMessageId,
          lastDeliveredAt: membership.lastDeliveredAt,

          updatedReceipts: messageIds.length,
        },
      );
    });
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

  private validateDuplicateMessage(
    existing: Message,
    dto: SendMessageDTO,
    content: string | null,
  ) {
    if (
      existing.conversationId !== dto.conversationId ||
      existing.type !== dto.type ||
      existing.content !== content
    ) {
      throw new ConflictException(
        'clientMessageId has already been used for another message',
      );
    }
  }
}
