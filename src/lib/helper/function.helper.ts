import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { CommonQueryDTO } from 'src/common/dto/common-query.dto';

export const otpGenerator = (size: number) => {
  const value = Math.pow(10, size - 1);
  const otp = Math.floor(value + Math.random() * (9 * value));
  return String(otp);
};

export const responseSender = <T>(
  message: string,
  status: number,
  success: boolean,
  data: T,
) => {
  return { message, status, data, success };
};

export const generatePhoneHash = (phoneNumber: string) => {
  return createHmac('sha256', process.env.PHONE_HASH_SECRET!)
    .update(phoneNumber)
    .digest('hex');
};

export const normalizePhoneNo = (countryCode: string, phoneNo: string) => {
  return `${countryCode}${phoneNo}`;
};

export const generatePagination = <T>(
  data: { rows: T[]; count: number },
  page: number,
  limit: number,
) => {
  return {
    data: data.rows,
    pageInfo: {
      total: data.count,
      page: Number(page),
      totalPage: Math.ceil(data.count / limit),
      limit,
    },
  };
};

export function getPagination(query: CommonQueryDTO) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
  };
}

export const generateDirectKey = (users: string[]) => {
  return users.sort().join(':');
};

export const encodeCursor = (data: { id: string; createdAt: Date }) => {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
};

export const decodeCursor = (cursor: string) => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
};
