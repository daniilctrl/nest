import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { FindMostActiveUsersQueryDto } from './dto/find-most-active-users-query.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull, In } from 'typeorm';
import { User } from './entities/user.entity';
import { Avatar } from '../avatars/entities/avatar.entity';
import { hashPassword } from '../common/utils/password.util';
import { Transactional } from 'typeorm-transactional';
import { TransferBalanceDto } from './dto/transfer-balance.dto';

const MIN_ACTIVE_AVATARS_FOR_MOST_ACTIVE = 2;

export interface MostActiveUserItem {
  user: Omit<User, 'password' | 'refreshToken'>;
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
  private static readonly CENTS_IN_DOLLAR = 100;
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Avatar)
    private avatarRepository: Repository<Avatar>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(
    createUserDto: CreateUserDto,
  ): Promise<Omit<User, 'password' | 'refreshToken'>> {
    this.logger.log(`Creating user with login "${createUserDto.login}"`);
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

    const createdUser = await this.usersRepository.save(user);
    await this.invalidateUsersCache();
    return this.sanitizeUser(createdUser);
  }

  async findAll(query: FindUsersQueryDto): Promise<{
    data: Array<Omit<User, 'password' | 'refreshToken'>>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.logger.debug(
      `Fetching users list (page=${query.page ?? 1}, limit=${query.limit ?? 10})`,
    );
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
      data: data.map((user) => this.sanitizeUser(user)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findMostActiveUsers(
    query: FindMostActiveUsersQueryDto,
  ): Promise<MostActiveUsersResult> {
    this.logger.debug(
      `Fetching most active users (ageMin=${query.ageMin}, ageMax=${query.ageMax})`,
    );
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
      user: this.sanitizeUser(user),
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

  async findOne(id: string): Promise<Omit<User, 'password' | 'refreshToken'>> {
    this.logger.debug(`Fetching user by id ${id}`);
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.sanitizeUser(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<Omit<User, 'password' | 'refreshToken'>> {
    this.logger.log(`Updating user ${id}`);
    const existingUser = await this.usersRepository.findOne({ where: { id } });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
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
      ...existingUser,
      ...restDto,
      ...(hashedPassword && { password: hashedPassword }),
    };

    const updatedUser = await this.usersRepository.save(dataToSave);
    await this.invalidateUsersCache();
    return this.sanitizeUser(updatedUser);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing user ${id}`);
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.usersRepository.softRemove(user);
    await this.invalidateUsersCache();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByLogin(login: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { login } });
  }

  @Transactional()
  async transferBalance(transferBalanceDto: TransferBalanceDto): Promise<void> {
    const { fromUserId, toUserId, amount } = transferBalanceDto;
    this.logger.log(
      `Transferring ${amount} from user ${fromUserId} to user ${toUserId}`,
    );

    if (fromUserId === toUserId) {
      throw new BadRequestException(
        'Sender and receiver must be different users',
      );
    }

    const orderedIds = [fromUserId, toUserId].sort();
    const users = await this.usersRepository
      .createQueryBuilder('user')
      .setLock('pessimistic_write')
      .where('user.id IN (:...ids)', { ids: orderedIds })
      .orderBy('user.id', 'ASC')
      .getMany();

    const sender = users.find((user) => user.id === fromUserId);
    if (!sender) {
      throw new NotFoundException(`User with ID ${fromUserId} not found`);
    }

    const receiver = users.find((user) => user.id === toUserId);
    if (!receiver) {
      throw new NotFoundException(`User with ID ${toUserId} not found`);
    }

    const amountCents = this.toCents(amount);
    const senderBalanceCents = this.toCents(sender.balance);
    const receiverBalanceCents = this.toCents(receiver.balance);
    const nextSenderBalanceCents = senderBalanceCents - amountCents;

    if (nextSenderBalanceCents < 0) {
      throw new BadRequestException('Insufficient balance');
    }

    sender.balance = this.toBalanceValue(nextSenderBalanceCents);
    receiver.balance = this.toBalanceValue(receiverBalanceCents + amountCents);

    await this.usersRepository.save([sender, receiver]);
    await this.invalidateUsersCache();
  }

  async resetAllBalances(): Promise<void> {
    this.logger.log('Resetting balances for all active users');
    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({ balance: '0.00' })
      .where('deletedAt IS NULL')
      .execute();
    await this.invalidateUsersCache();
  }

  private toCents(value: string | number): number {
    const numericValue = typeof value === 'number' ? value : Number(value);
    return Math.round(numericValue * UsersService.CENTS_IN_DOLLAR);
  }

  private toBalanceValue(cents: number): string {
    return (cents / UsersService.CENTS_IN_DOLLAR).toFixed(2);
  }

  private sanitizeUser(user: User): Omit<User, 'password' | 'refreshToken'> {
    const { password, refreshToken, ...safeUser } = user;
    void password;
    void refreshToken;
    return safeUser;
  }

  private async invalidateUsersCache(): Promise<void> {
    await this.cacheManager.clear();
    this.logger.debug('Users-related cache invalidated');
  }
}
