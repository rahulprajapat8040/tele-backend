import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import type { IAuthUser } from 'src/lib/interfaces/user.interface';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import {
  MarkMessagesDeliveredDTO,
  MarkMessagesReadDTO,
  SendMessageDTO,
} from './dto/messages.dto';
import { ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { GetMessageHistoryDTO } from './dto/messages-query.dto';

@ApiBearerAuth('access-token')
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async sendMessage(
    @CurrentUser() user: IAuthUser,
    @Body() dto: SendMessageDTO,
  ) {
    return this.messagesService.sendMessage(user, dto);
  }

  @ApiParam({ name: 'conversationId', description: 'conversation id' })
  @Get('conversation/:conversationId/history')
  @UseGuards(JwtAuthGuard)
  async getMessageHistory(
    @CurrentUser() user: IAuthUser,
    @Param('conversationId') conversationId: string,
    @Query() query: GetMessageHistoryDTO,
  ) {
    return this.messagesService.getMessageHistory(user, conversationId, query);
  }

  @Patch('conversations/:conversationId/read')
  @UseGuards(JwtAuthGuard)
  async markMessagesAsRead(
    @CurrentUser() user: IAuthUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: MarkMessagesReadDTO,
  ) {
    return this.messagesService.markMessagesAsRead(user, conversationId, dto);
  }

  @Patch('conversations/:conversationId/delivered')
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation ID',
  })
  @UseGuards(JwtAuthGuard)
  async markAsDelivered(
    @CurrentUser() user: IAuthUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: MarkMessagesDeliveredDTO,
  ) {
    return this.messagesService.markAsDelivered(
      user,
      conversationId,
      dto.lastDeliveredMessageId,
    );
  }
}
