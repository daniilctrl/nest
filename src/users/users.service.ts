import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { FindMostActiveUsersQueryDto } from './dto/find-most-active-users-query.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull, In } from 'typeorm';
import { User } from './entities/user.entity';
import { Avatar } from '../avatars/entities/avatar.entity';
import { hashPassword } from '../common/utils/password.util';

const MIN_ACTIVE_AVATARS_FOR_MOST_ACTIVE = 2;

export interface MostActiveUserItem {
  user: User;
  lastAvatar: Avatar | null;
}

export interface MostActiveUsersResult {
  data: MostActiveUserItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Avatar)
    private avatarRepository: Repository<Avatar>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUserByLogin = await this.usersRepository.findOne({
      where: { login: createUserDto.login },
    });

    if (existingUserByLogin) {
      throw new ConflictException('User with this login already exists');
    }

    const existingUserByEmail = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUserByEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await hashPassword(createUserDto.password);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return this.usersRepository.save(user);
  }

  async findAll(query: FindUsersQueryDto): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, login } = query;
    const skip = (page - 1) * limit;

    const whereCondition = login ? { login: Like(`%${login}%`) } : {};

    const [data, total] = await this.usersRepository.findAndCount({
      where: whereCondition,
      take: limit,
      skip: skip,
      order: { createdAt: 'DESC' },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findMostActiveUsers(
    query: FindMostActiveUsersQueryDto,
  ): Promise<MostActiveUsersResult> {
    const { ageMin, ageMax, page = 1, limit = 20 } = query;

    if (ageMin > ageMax) {
      throw new BadRequestException(
        'ageMin must be less than or equal to ageMax',
      );
    }

    const skip = (page - 1) * limit;

    const usersWithManyActiveAvatarsSubQuery = this.avatarRepository
      .createQueryBuilder('a')
      .select('a.userId')
      .where('a.deletedAt IS NULL')
      .groupBy('a.userId')
      .having('COUNT(*) > :minActive', {
        minActive: MIN_ACTIVE_AVATARS_FOR_MOST_ACTIVE,
      });

    const qb = this.usersRepository
      .createQueryBuilder('u')
      .where(`u.id IN (${usersWithManyActiveAvatarsSubQuery.getQuery()})`)
      .andWhere('TRIM(u.description) != :empty', { empty: '' })
      .andWhere('u.age >= :ageMin', { ageMin })
      .andWhere('u.age <= :ageMax', { ageMax })
      .andWhere('u.deletedAt IS NULL')
      .orderBy('u.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    qb.setParameters({
      ...qb.getParameters(),
      ...usersWithManyActiveAvatarsSubQuery.getParameters(),
    });

    const [users, total] = await qb.getManyAndCount();

    const userIds = users.map((user) => user.id);
    const lastAvatarByUserId = new Map<string, Avatar>();

    if (userIds.length > 0) {
      const avatars = await this.avatarRepository.find({
        where: { userId: In(userIds), deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });
      for (const avatar of avatars) {
        if (!lastAvatarByUserId.has(avatar.userId)) {
          lastAvatarByUserId.set(avatar.userId, avatar);
        }
      }
    }

    const data: MostActiveUserItem[] = users.map((user) => ({
      user,
      lastAvatar: lastAvatarByUserId.get(user.id) ?? null,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    const hashedPassword = updateUserDto.password
      ? await hashPassword(updateUserDto.password)
      : undefined;

    const { password, ...restDto } = updateUserDto;

    const dataToSave = {
      ...user,
      ...restDto,
      ...(hashedPassword && { password: hashedPassword }),
    };

    return this.usersRepository.save(dataToSave);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.softRemove(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByLogin(login: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { login } });
  }
}
