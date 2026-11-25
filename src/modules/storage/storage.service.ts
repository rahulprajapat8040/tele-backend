import {
    DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { STORAGE_CLIENT } from 'src/lib/constant/constant';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = process.env.STORAGE_BUCKET!;

  constructor(@Inject(STORAGE_CLIENT) private readonly s3: S3Client) {}

  async generateUploadUrl(fileName: string, contentType: string) {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'audio/mpeg',
      'audio/mp4',
      'audio/webm',
      'application/pdf',
    ];

    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestException('Unsupported file type');
    }

    const extension = fileName.split('.').pop()?.toLowerCase() || 'bin';

    const key = `originals/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });

    return {
      key,
      uploadUrl,
      expiresIn: 300,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
    };
  }
  async verifyUpload(key: string) {
    try {
      const result = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      return {
        key,
        size: result.ContentLength,
        contentType: result.ContentType,
        uploaded: true,
      };
    } catch (error) {
      throw new NotFoundException('Upload file not found');
    }
  }

  async deleteFile(key: string) {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    return { deleted: true };
  }
}
