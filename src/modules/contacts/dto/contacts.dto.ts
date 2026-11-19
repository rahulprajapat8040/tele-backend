import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsPhoneNumber,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ContactItemDTO {
  @ApiProperty({
    example: 'Amit Sharma',
    description: "Contact name saved in the user's phone",
  })
  @IsOptional()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: '+919876543210',
    description: 'Contact phone number in E.164 format',
  })
  @IsPhoneNumber()
  phoneNumber: string;
}

export class SyncContactDTO {
  @ApiProperty({
    type: [ContactItemDTO],
    example: [
      {
        name: 'Amit Sharma',
        phoneNumber: '+919876543210',
      },
      {
        name: 'Rahul Kumar',
        phoneNumber: '+919876543211',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactItemDTO)
  contacts: ContactItemDTO[];
}
