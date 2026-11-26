import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class UploadMediaDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Image, video, audio, or document file',
  })
  @IsNotEmpty()
  file: any;
}
