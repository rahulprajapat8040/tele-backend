import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { storageConfig } from './storage.config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      endpoint: storageConfig.endpoint,
      region: storageConfig.region,
      credentials: {
        accessKeyId: storageConfig.accessKeyId!,
        secretAccessKey: storageConfig.secretAccessKey!,
      },
      forcePathStyle: storageConfig.forcePathStyle,
    });
  }

  async uploadFile(params: { key: string; buffer: Buffer; mimeType: string }) {
    const command = new PutObjectCommand({
      Bucket: storageConfig.bucket,
      Key: params.key,
      Body: params.buffer,
      ContentType: params.mimeType,
    });

    this.s3.send(command);

    return {
      key: params.key,
      bucket: storageConfig.bucket,
    };
  }

  async deleteFile(key: string) {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: storageConfig.bucket,
        Key: key,
      }),
    );

    return true;
  }

  async getFileMetadata(key: string) {
    return this.s3.send(
      new HeadObjectCommand({
        Bucket: storageConfig.bucket,
        Key: key,
      }),
    );
  }

  async generateDownloadUrl(key: string, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: storageConfig.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3, command, {
      expiresIn,
    });
  }
}
