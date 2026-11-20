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
  ) {}

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

        socket.data.user = { userId };

        return next();
      } catch (error) {
        return next(new Error('Unauthorized'));
      }
    });
  }

  async handleConnection(client: Socket) {
    const { userId } = client.data.user;

    const room = `user:${userId}`;

    await client.join(room);

    console.log('SOCKET ROOM JOINED:', {
      userId,
      socketId: client.id,
      room,
      rooms: [...client.rooms],
    });
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user;

    if (!user) return;
  }

  @SubscribeMessage(CHAT_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDTO,
  ) {
    try {
      const user = client.data.user;

      const message = await this.messageService.sendMessage(user, dto);
      this.logger.log(`Message send by user ${user.userId} ${message}`);
      const recipientIds = await this.messageService.getRecipientUserIds(
        dto.conversationId,
        user.userId,
      );

      for (const recipientId of recipientIds) {
        this.server
          .to(`user:${recipientId}`)
          .emit(CHAT_EVENTS.NEW_MESSAGE, message);
      }

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

    const result = await this.messageService.markAsDelivered(
      user,
      data.conversationId,
      data.lastDeliveredMessageId,
    );

    // Find other conversation members
    const recipientIds = await this.messageService.getRecipientUserIds(
      data.conversationId,
      user.userId,
    );

    // Notify message sender(s)
    for (const recipientId of recipientIds) {
      this.server.to(`user:${recipientId}`).emit(CHAT_EVENTS.MESSAGE_STATUS, {
        conversationId: data.conversationId,
        lastDeliveredMessageId: data.lastDeliveredMessageId,
        status: 'DELIVERED',
        deliveredBy: user.userId,
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

    const message = await this.messageService.findMessageById(
      data.lastReadMessageId,
      data.conversationId,
    );

    // Notify the original sender
    this.server
      .to(`user:${message.senderId}`)
      .emit(CHAT_EVENTS.MESSAGE_STATUS, {
        conversationId: data.conversationId,
        lastReadMessageId: data.lastReadMessageId,
        status: 'READ',
        readBy: user.userId,
      });

    return {
      success: true,
      data: result,
    };
  }

  @SubscribeMessage(CHAT_EVENTS.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = client.data.user;

    const isMember = await this.messageService.isConversationMember(
      user.userId,
      data.conversationId,
    );

    if (!isMember) {
      throw new WsException('Access denied');
    }

    client
      .to(`conversation:${data.conversationId}`)
      .emit(CHAT_EVENTS.USER_TYPING, {
        conversationId: data.conversationId,
        userId: user.userId,
        isTyping: true,
      });
  }
}
