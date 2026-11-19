import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { SyncContactDTO } from './dto/contacts.dto';
import type { IAuthUser } from 'src/lib/interfaces/user.interface';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CommonQueryDTO } from 'src/common/dto/common-query.dto';

@ApiBearerAuth('access-token')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  sync(@Body() dto: SyncContactDTO, @CurrentUser() user: IAuthUser) {
    return this.contactsService.sync(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getContacts(@CurrentUser() user: IAuthUser, @Query() query: CommonQueryDTO) {
    return this.contactsService.getContacts(user, query);
  }
}
