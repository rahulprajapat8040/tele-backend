import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
} from '@nestjs/swagger';
import { DevicePlatform } from 'src/utils/constant/enums';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeviceDTO {
  @ApiProperty({
    example: DevicePlatform.ANDROID,
    description: 'Device platform using',
    enum: DevicePlatform,
  })
  @IsNotEmpty()
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiProperty({ example: 'C.2.HX', description: 'device name' })
  @IsNotEmpty()
  deviceName: string;

  @ApiPropertyOptional({ example: 'VIVO', description: 'Device model' })
  @IsOptional()
  model: string;

  @ApiPropertyOptional({
    example: '1.01',
    description: 'application version user using',
  })
  @IsOptional()
  appVersion: string;
}

export class OTPReqDTO extends DeviceDTO {
  @ApiProperty({ example: '+91', description: 'country code of the user' })
  @IsNotEmpty()
  @IsString()
  countryCode: string;

  @ApiProperty({ example: '1212121212', description: 'phone no of the user' })
  @IsNotEmpty()
  @IsString()
  phoneNo: string;
}

export class SignupDTO extends OTPReqDTO {
  @ApiPropertyOptional({
    example: 'Rohan',
    description: 'first name of the user',
  })
  @IsOptional()
  firstName: string;

  @ApiPropertyOptional({
    example: 'Kumar',
    description: 'last name of the user',
  })
  @IsOptional()
  lastName: string;

  @ApiProperty({
    example: '232322',
    description: 'OTP of the user',
  })
  @IsNotEmpty()
  otp: string;
}

export class LoginDTO extends OTPReqDTO {
  @ApiProperty({
    example: '232322',
    description: 'OTP of the user',
  })
  @IsNotEmpty()
  otp: string;
}
