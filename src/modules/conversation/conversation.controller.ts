import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { IAuthUser } from 'src/lib/interfaces/user.interface';
import { ConversationService } from './conversation.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CreatePrivateConversationDTO } from './dto/conversation.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CommonQueryDTO } from 'src/common/dto/common-query.dto';

@ApiBearerAuth('access-token')
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(private readonly conversationsService: ConversationService) {}

  @Post('private')
  async createPrivateConversation(
    @CurrentUser() user: IAuthUser,
    @Body() dto: CreatePrivateConversationDTO,
  ) {
    return this.conversationsService.createPrivateConversation(user, dto);
  }

  @Get('my')
  getMyConversations(
    @Query() query: CommonQueryDTO,
    @CurrentUser() user: IAuthUser,
  ) {
    return this.conversationsService.getMyConversations(query, user);
  }
}
