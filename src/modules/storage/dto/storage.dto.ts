import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class GenerateUploadUrlDto {
  @ApiProperty({ example: 'user.jpg', description: 'Name of the file' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ example: 'jpg', description: 'content type' })
  @IsString()
  @IsNotEmpty()
  contentType: string;
}


export class ConfirmUploadDto {
  @ApiProperty({ example: 'confirm-key' })
  @IsString()
  @IsNotEmpty()
  key: string;
}