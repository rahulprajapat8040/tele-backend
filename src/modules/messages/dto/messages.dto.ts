import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MessageType } from 'src/lib/enum';

export class SendMessageDTO {
  @ApiProperty({
    example: 'conversation-uuid',
  })
  @IsUUID()
  conversationId: string;

  @ApiProperty({
    example: 'client-generated-message-uuid',
  })
  @IsUUID()
  clientMessageId: string;

  @ApiProperty({
    enum: MessageType,
    example: MessageType.TEXT,
  })
  @IsEnum(MessageType)
  type: MessageType;

  @ApiProperty({ example: 'reply to message id' })
  @IsOptional()
  replyToMessageId: string | null;

  @ApiProperty({
    example: 'Hello Amit!',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;
}

export class DeleteMessageDTO {
  @ApiProperty({ example: 'conversation-uuid' })
  @IsUUID()
  conversationId: string;

  @ApiProperty({ example: 'message-uuid' })
  @IsUUID()
  messageId: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  forEveryone: boolean;
}

export class EditMessageDTO {
  @ApiProperty({ example: 'conversation-uuid' })
  @IsUUID()
  conversationId: string;

  @ApiProperty({ example: 'message-uuid' })
  @IsUUID()
  messageId: string;

  @ApiProperty({ example: 'Updated text' })
  @IsString()
  @MaxLength(10000)
  content: string;
}

export class MarkMessagesReadDTO {
  @IsUUID()
  lastReadMessageId: string;
}

export class MarkMessagesDeliveredDTO {
  @IsUUID()
  lastDeliveredMessageId: string;
}
