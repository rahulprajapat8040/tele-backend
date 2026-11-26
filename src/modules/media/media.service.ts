import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { StorageService } from './storage/storage.service';
import { MediaStatus, MediaType } from 'src/lib/enum';
import {
  ALLOWED_AUDIO_TYPES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_MEDIA_TYPES,
  ALLOWED_VIDEO_TYPES,
  AUDIO_MAX_SIZE,
  DOCUMENT_MAX_SIZE,
  IMAGE_MAX_SIZE,
  MEDIA_BUCKET,
  VIDEO_MAX_SIZE,
} from 'src/lib/constant/media.constant';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { Media } from '../database/models';
import { InjectModel } from '@nestjs/sequelize';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  constructor(
    private readonly storageService: StorageService,
    @InjectModel(Media) private readonly mediaModel: typeof Media,
  ) {}

  private getMediaType(mimeType: string): MediaType {
    if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      return MediaType.IMAGE;
    }

    if (ALLOWED_VIDEO_TYPES.includes(mimeType)) {
      return MediaType.VIDEO;
    }

    if (ALLOWED_AUDIO_TYPES.includes(mimeType)) {
      return MediaType.AUDIO;
    }

    return MediaType.DOCUMENT;
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!ALLOWED_MEDIA_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const mediaType = this.getMediaType(file.mimetype);

    let maxSize = DOCUMENT_MAX_SIZE;

    switch (mediaType) {
      case MediaType.IMAGE:
        maxSize = IMAGE_MAX_SIZE;
        break;

      case MediaType.VIDEO:
        maxSize = VIDEO_MAX_SIZE;
        break;

      case MediaType.AUDIO:
        maxSize = AUDIO_MAX_SIZE;
        break;

      case MediaType.DOCUMENT:
        maxSize = DOCUMENT_MAX_SIZE;
        break;
    }

    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds the limit of ${Math.round(maxSize / 1024 / 1024)} MB`,
      );
    }

    return mediaType;
  }

  async uploadFile(file: Express.Multer.File, userId: string) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const extension = extname(file.originalname).toLocaleLowerCase();

    const mediaType = this.getMediaType(file.mimetype);

    const id = randomUUID();

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const storageKey = [
      'users',
      userId,
      'media',
      year,
      month,
      `${id}${extension}`,
    ].join('/');

    await this.storageService.uploadFile({
      key: storageKey,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    try {
      const media = await this.mediaModel.create({
        id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        mediaType,
        storageKey,
        bucket: MEDIA_BUCKET,
        uploadedById: userId,
        status: MediaStatus.READY,
        thumbnailKey: null,
        width: null,
        height: null,
        duration: null,
      });

      return {
        id: media.id,
        originalName: media.originalName,
        mimeType: media.mimeType,
        size: media.size.toString(),
        mediaType: media.mediaType,
        status: media.status,
        createdAt: media.createdAt,
        width: media.width,
        height: media.height,
        duration: media.duration,
      };
    } catch (error) {
      try {
        await this.storageService.deleteFile(storageKey);
      } catch (cleanUpError) {
        this.logger.error(
          `Failed to clean up RustFS object: ${JSON.stringify(cleanUpError)}`,
        );
      }
      throw error;
    }
  }

  async findById(id: string) {
    const media = await this.mediaModel.findByPk(id);

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return media;
  }

  async getMyMedia(id: string, userId: string) {
    const media = await this.findById(id);

    if (media.uploadedById !== userId) {
      throw new ForbiddenException("You don't own this media");
    }

    return media;
  }

  async getDownloadUrl(storageKey: string) {
    return this.storageService.generateDownloadUrl(storageKey);
  }

  async deleteMedia(id: string, userId: string) {
    const media = await this.getMyMedia(id, userId);
    const url = this.storageService.deleteFile(media.storageKey);
    return {
      id: media.id,
      url,
      expiresIn: 3600,
    };
  }

  private getSafeExtension(originalName: string) {
    const lastDot = originalName.lastIndexOf('.');

    if (lastDot === 1) {
      return '';
    }

    const extension = originalName.substring(lastDot).toLowerCase();

    if (!/^\.[a-z0-9]{1,10}$/.test(extension)) {
      return '';
    }

    return extension;
  }
}
