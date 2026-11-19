import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreatePrivateConversationDTO {
  @ApiProperty({
    example: 'a2f48a7e-2b0c-4f2c-9a52-1b92f8f6d123',
    description: 'UUID of the user you want to chat with',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
