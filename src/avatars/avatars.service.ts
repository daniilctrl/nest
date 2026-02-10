import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { randomUUID } from 'crypto';
import { Avatar } from './entities/avatar.entity';
import { IFileService } from '../providers/files/files.adapter';
import { UploadFilePayloadDto } from '../providers/files/s3/dto/upload-file-payload.dto';
import {
  MAX_ACTIVE_AVATARS_PER_USER,
  AVATARS_UPLOAD_FOLDER,
} from './constants';
import { IUploadedMulterFile } from '../providers/files/s3/interfaces/upload-file.interface';

@Injectable()
export class AvatarsService {
  constructor(
    @InjectRepository(Avatar)
    private readonly avatarRepository: Repository<Avatar>,
    private readonly fileService: IFileService,
  ) {}

  async findAllByUserId(userId: string): Promise<Avatar[]> {
    return this.avatarRepository.find({
      where: { userId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async uploadAvatar(
    userId: string,
    file: IUploadedMulterFile,
  ): Promise<Avatar> {
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }

    const activeCount = await this.avatarRepository.count({
      where: { userId, deletedAt: IsNull() },
    });

    if (activeCount >= MAX_ACTIVE_AVATARS_PER_USER) {
      throw new BadRequestException(
        `Maximum number of active avatars (${MAX_ACTIVE_AVATARS_PER_USER}) reached. Delete an avatar to upload a new one.`,
      );
    }

    const extension =
      file.originalname?.split('.').pop() ||
      this.getExtensionFromMimetype(file.mimetype) ||
      'bin';
    const fileName = `${userId}-${randomUUID()}.${extension}`;

    const uploadPayload: UploadFilePayloadDto = {
      file,
      folder: AVATARS_UPLOAD_FOLDER,
      name: fileName,
    };

    const { path } = await this.fileService.uploadFile(uploadPayload);

    const avatar = this.avatarRepository.create({
      userId,
      path,
    });

    return this.avatarRepository.save(avatar);
  }

  async removeAvatar(avatarId: string, userId: string): Promise<void> {
    const avatar = await this.avatarRepository.findOne({
      where: { id: avatarId },
    });

    if (!avatar) {
      throw new NotFoundException(`Avatar with ID ${avatarId} not found`);
    }

    if (avatar.userId !== userId) {
      throw new ForbiddenException('You can only delete your own avatars');
    }

    await this.avatarRepository.softRemove(avatar);

    await this.fileService.removeFile({ path: avatar.path });
  }

  private getExtensionFromMimetype(mimetype?: string): string | null {
    if (!mimetype) return null;
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    return map[mimetype] ?? null;
  }
}
