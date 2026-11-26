import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiParam } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { UploadMediaDto } from './dto/media.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ALLOWED_MEDIA_TYPES,
  MEDIA_MAX_SIZE,
} from 'src/lib/constant/media.constant';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { IAuthUser } from 'src/lib/interfaces/user.interface';

@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: UploadMediaDto,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { files: MEDIA_MAX_SIZE },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MEDIA_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Unsupported media type'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IAuthUser,
  ) {
    return this.mediaService.uploadFile(file, user.id);
  }

  @Post('upload-multipe')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: MEDIA_MAX_SIZE },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MEDIA_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Unsupported media type'),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: IAuthUser,
  ) {
    if (!files?.length) {
      throw new BadRequestException('At least one file is required');
    }

    const results = await Promise.all(
      files.map((file) => this.mediaService.uploadFile(file, user.id)),
    );

    return results;
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    description: 'Media UUID',
  })
  async getMedia(@Param('id') id: string, @CurrentUser() user: IAuthUser) {
    return this.mediaService.getMyMedia(id, user.id);
  }
}
