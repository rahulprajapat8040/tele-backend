import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CHAT_EVENTS } from './chat.events';
import { MessagesService } from 'src/modules/messages/messages.service';
import { SendMessageDTO } from 'src/modules/messages/dto/messages.dto';
import { parseCookie } from 'cookie';
import { Logger } from '@nestjs/common';
import { ACCESS_TOKEN_KEY } from 'src/lib/constant/constant';
import { PresenceService } from 'src/modules/presence/presence.service';
import { UsersService } from 'src/modules/users/users.service';
import { ConversationService } from 'src/modules/conversation/conversation.service';

@WebSocketGateway({
  cors: { origin: ['*'], credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly messageService: MessagesService,
    private readonly presenceService: PresenceService,
    private readonly userService: UsersService,
    private readonly conversationService: ConversationService,
  ) {}

  private typingUsers = new Map<string, Set<string>>();

  private broadcastTyping(
    client: Socket,
    conversationId: string,
    isTyping: boolean,
  ) {
    client.to(`conversation:${conversationId}`).emit(CHAT_EVENTS.USER_TYPING, {
      conversationId,
      userId: client.data.user.id,
      isTyping,
    });
  }

  private async broadcastPresence(userId: string, event: string, payload: any) {
    const conversationIds =
      await this.conversationService.getActiveConversationIds(userId);

    for (const conversationId of conversationIds) {
      this.server.to(`conversation:${conversationId}`).emit(event, payload);
    }
  }

  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        // 1. Mobile app: token from handshake.auth
        let token = socket.handshake.auth?.token;

        // 2. Web app: token from HttpOnly cookie
        this.logger.log(`Token coming from device ${token}`);
        if (!token) {
          const cookies = parseCookie(socket.handshake.headers.cookie || '');
          token = cookies[ACCESS_TOKEN_KEY]; // Use your actual cookie name
          this.logger.log(`Token coming from cookies ${token}`);
        }

        if (!token) {
          return next(new Error('Unauthorized'));
        }

        const payload = await this.jwtService.verifyAsync(token);

        const userId = payload.userId;

        if (!userId) {
          return next(new Error('Invalid token payload'));
        }

        socket.data.user = { id: userId };

        return next();
      } catch (error) {
        return next(new Error('Unauthorized'));
      }
    });
  }

  async handleConnection(client: Socket) {
    const { id } = client.data.user;

    const room = `user:${id}`;

    const becameOnline = await this.presenceService.addSocket(id, client.id);

    if (becameOnline) {
      await this.broadcastPresence(id, 'USER_ONLINE', {
        id,
        status: 'online',
      });
    }

    await client.join(room);
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.user.id;
    const conversations = this.typingUsers.get(client.id);

    if (!conversations) return;

    for (const conversationId of conversations) {
      this.broadcastTyping(client, conversationId, false);
    }

    const becameOffline = await this.presenceService.removeSocket(
      userId,
      client.id,
    );

    if (becameOffline) {
      const lastSeenAt = new Date();

      await this.userService.updateLastSeen(userId, lastSeenAt);

      await this.broadcastPresence(userId, 'USER_OFFLINE', {
        userId,
        status: 'offline',
        lastSeenAt,
      });
    }

    this.typingUsers.delete(client.id);
  }

  @SubscribeMessage(CHAT_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDTO,
  ) {
    try {
      const user = client.data.user;

      const message = await this.messageService.sendMessage(user, dto);
      this.logger.log(`Message send by user ${user.id} ${message}`);
      const recipientIds = await this.messageService.getRecipientUserIds(
        dto.conversationId,
        user.id,
      );

      for (const recipientId of recipientIds) {
        this.server
          .to(`user:${recipientId}`)
          .emit(CHAT_EVENTS.NEW_MESSAGE, message);
      }
      this.logger.log(
        `Message recieved to users, ${JSON.stringify(recipientIds)}`,
      );

      return { success: true, message };
    } catch (error) {
      throw new WsException(error.message || 'Message sending failed');
    }
  }

  @SubscribeMessage(CHAT_EVENTS.MESSAGE_DELIVERED)
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      lastDeliveredMessageId: string;
    },
  ) {
    const user = client.data.user;
    this.logger.log('Message delivery', user);
    const result = await this.messageService.markAsDelivered(
      user,
      data.conversationId,
      data.lastDeliveredMessageId,
    );
    console.log('DELIVERY RESULT:', JSON.stringify(result, null, 2));
    // Notify only the senders whose messages had receipts updated
    for (const senderId of result.data.senderIds) {
      this.server.to(`user:${senderId}`).emit(CHAT_EVENTS.MESSAGE_STATUS, {
        conversationId: data.conversationId,
        messageIds: result.data.updatedMessageIds,
        lastDeliveredMessageId: data.lastDeliveredMessageId,
        status: 'DELIVERED',
        deliveredBy: user.id,
        deliveredAt: result.data.deliveredAt,
      });
    }

    return {
      success: true,
      data: result,
    };
  }

  @SubscribeMessage(CHAT_EVENTS.MESSAGE_READ)
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      lastReadMessageId: string;
    },
  ) {
    const user = client.data.user;

    const result = await this.messageService.markMessagesAsRead(
      user,
      data.conversationId,
      {
        lastReadMessageId: data.lastReadMessageId,
      },
    );

    const readData = result?.data ?? result;

    const senderMessageMap = readData?.senderMessageMap ?? {};

    // Notify each original sender about the messages read by this user
    for (const [senderId, messageIds] of Object.entries(senderMessageMap)) {
      if (!messageIds.length) continue;

      this.server.to(`user:${senderId}`).emit(CHAT_EVENTS.MESSAGE_STATUS, {
        conversationId: data.conversationId,
        messageIds,
        status: 'READ',
        readBy: user.id,
        readAt: readData.readAt,
      });
    }

    return {
      success: true,
      data: result,
    };
  }

  @SubscribeMessage(CHAT_EVENTS.CONVERSATION_JOIN)
  async handleConversationJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const { conversationId } = data;

    if (!conversationId) return;

    const room = `conversation:${conversationId}`;

    // IMPORTANT:
    // Verify this authenticated user is actually a member
    // of this conversation before allowing them to join.
    // Replace this with your existing membership check.
    // e.g. await this.conversationService.isMember(...)

    await client.join(room);

    this.logger.log(`Socket ${client.id} joined conversation room ${room}`);

    return {
      success: true,
      conversationId,
    };
  }

  @SubscribeMessage(CHAT_EVENTS.TYPING_START)
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const conversationId = data?.conversationId;
    const room = `conversation:${conversationId}`;

    if (!conversationId || !client.rooms.has(room)) {
      this.logger.warn('TYPING ABORTED: Socket is not in conversation room');
      return;
    }

    let conversations = this.typingUsers.get(client.id);

    if (!conversations) {
      conversations = new Set<string>();
      this.typingUsers.set(client.id, conversations);
    }

    // Prevent duplicate START broadcasts
    if (conversations.has(conversationId)) return;

    conversations.add(conversationId);

    this.logger.log(`TYPING START: ${client.data.user.id}`);

    this.broadcastTyping(client, conversationId, true);
  }

  @SubscribeMessage(CHAT_EVENTS.TYPING_STOP)
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const conversationId = data?.conversationId;
    const room = `conversation:${conversationId}`;

    if (!conversationId || !client.rooms.has(room)) return;

    const conversations = this.typingUsers.get(client.id);

    // Only stop if this socket was actually typing
    if (!conversations?.has(conversationId)) return;

    conversations.delete(conversationId);

    this.logger.log(`TYPING STOP: ${client.data.user.id}`);

    this.broadcastTyping(client, conversationId, false);

    if (conversations.size === 0) {
      this.typingUsers.delete(client.id);
    }
  }

  @SubscribeMessage(CHAT_EVENTS.SYNC_PENDING_MESSAGES)
  async handleSyncPendingMessages(@ConnectedSocket() client: Socket) {
    const user = client.data.user;

    const pendingMessages =
      await this.messageService.getPendingDeliveryMessages(user.id);

    this.logger.log(
      `Pending messages sync for user ${user.id}: ${pendingMessages.length}`,
    );

    if (!pendingMessages.length) {
      return {
        success: true,
        count: 0,
      };
    }

    // Send all undelivered messages to the connected client.
    for (const message of pendingMessages) {
      client.emit(CHAT_EVENTS.NEW_MESSAGE, message);
    }

    return {
      success: true,
      count: pendingMessages.length,
    };
  }
}
