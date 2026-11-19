import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { IAuthUser } from 'src/lib/interfaces/user.interface';
import { ConversationService } from './conversation.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CreatePrivateConversationDTO } from './dto/conversation.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

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
}
