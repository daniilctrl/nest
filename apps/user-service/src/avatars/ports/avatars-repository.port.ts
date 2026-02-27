import { Avatar } from '../entities/avatar.entity';

export const AVATARS_REPOSITORY = Symbol('AVATARS_REPOSITORY');

export interface AvatarsRepositoryPort {
  findLastActiveByUserIds(userIds: string[]): Promise<Map<string, Avatar>>;
}
