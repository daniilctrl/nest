import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Avatar } from '../entities/avatar.entity';
import { AvatarsRepositoryPort } from '../ports/avatars-repository.port';

@Injectable()
export class TypeOrmAvatarsRepository implements AvatarsRepositoryPort {
  constructor(
    @InjectRepository(Avatar)
    private readonly avatarsRepository: Repository<Avatar>,
  ) {}

  async findLastActiveByUserIds(
    userIds: string[],
  ): Promise<Map<string, Avatar>> {
    const lastAvatarByUserId = new Map<string, Avatar>();

    if (userIds.length === 0) {
      return lastAvatarByUserId;
    }

    const avatars = await this.avatarsRepository.find({
      where: { userId: In(userIds), deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    for (const avatar of avatars) {
      if (!lastAvatarByUserId.has(avatar.userId)) {
        lastAvatarByUserId.set(avatar.userId, avatar);
      }
    }

    return lastAvatarByUserId;
  }
}
