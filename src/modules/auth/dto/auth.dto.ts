import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { randomUUID } from 'crypto';
import { DeviceType } from 'src/lib/enum';

const uuid = randomUUID();

export class DeviceInfoDTO {
  @ApiProperty({ example: uuid, description: 'device id' })
  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @ApiProperty({ example: uuid, description: 'device token' })
  @IsOptional()
  deviceToken: string;

  @ApiProperty({
    example: DeviceType.ANDROID,
    description: 'Device type',
    enum: DeviceType,
  })
  @IsNotEmpty()
  @IsEnum(DeviceType)
  deviceType: DeviceType;
}

export class SendOTPDTO {
  @ApiProperty({ example: 'identified', description: 'otp identifier' })
  @IsNotEmpty()
  @IsString()
  identifier: string;
}

export class LoginDTO extends DeviceInfoDTO {
  @ApiProperty({
    example: '+91',
    description: 'Country code of the user phone no',
  })
  @IsNotEmpty()
  @IsString()
  countryCode: string;

  @ApiProperty({ example: 'rahul@gmail.com', description: 'User phone number' })
  @IsNotEmpty()
  @IsString()
  phoneNo: string;

  @ApiProperty({ example: '23343', description: 'OTP' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(6)
  otp: string;
}

export class SignupDTO extends DeviceInfoDTO {
  @ApiProperty({ example: 'Rahul', description: 'First name of the user' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'prajapat', description: 'Last name of the user' })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty({
    example: '+91',
    description: 'Country code of the user phone no',
  })
  @IsNotEmpty()
  @IsString()
  countryCode: string;

  @ApiProperty({ example: 'rahul@gmail.com', description: 'User phone number' })
  @IsNotEmpty()
  @IsString()
  phoneNo: string;

  @ApiProperty({ example: '23343', description: 'OTP' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(6)
  otp: string;
}
