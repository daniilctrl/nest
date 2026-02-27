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
import { User } from './entities/user.entity';
import { Avatar } from '../avatars/entities/avatar.entity';
import { hashPassword, toBalanceValue, toCents } from '@app/shared';
import { Transactional } from 'typeorm-transactional';
import { TransferBalanceDto } from './dto/transfer-balance.dto';
import { USERS_REPOSITORY } from './ports/users-repository.port';
import type { UsersRepositoryPort } from './ports/users-repository.port';
import { AVATARS_REPOSITORY } from '../avatars/ports/avatars-repository.port';
import type { AvatarsRepositoryPort } from '../avatars/ports/avatars-repository.port';

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
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepositoryPort,
    @Inject(AVATARS_REPOSITORY)
    private readonly avatarsRepository: AvatarsRepositoryPort,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(
    createUserDto: CreateUserDto,
  ): Promise<Omit<User, 'password' | 'refreshToken'>> {
    this.logger.log(`Creating user with login "${createUserDto.login}"`);
    const existingUserByLogin = await this.usersRepository.findByLogin(
      createUserDto.login,
    );

    if (existingUserByLogin) {
      throw new ConflictException('User with this login already exists');
    }

    const existingUserByEmail = await this.usersRepository.findByEmail(
      createUserDto.email,
    );

    if (existingUserByEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await hashPassword(createUserDto.password);

    const createdUser = await this.usersRepository.createAndSave({
      ...createUserDto,
      password: hashedPassword,
    });
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
    const { data, total } = await this.usersRepository.findPaginated({
      page,
      limit,
      login,
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

    const { users, total } = await this.usersRepository.findMostActive({
      ageMin,
      ageMax,
      page,
      limit,
      minActiveAvatars: MIN_ACTIVE_AVATARS_FOR_MOST_ACTIVE,
    });
    const userIds = users.map((user) => user.id);
    const lastAvatarByUserId =
      await this.avatarsRepository.findLastActiveByUserIds(userIds);

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
    const user = await this.usersRepository.findById(id);

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
    const existingUser = await this.usersRepository.findById(id);

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const existingUser = await this.usersRepository.findByEmail(
        updateUserDto.email,
      );

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

    const updatedUser = await this.usersRepository.save(dataToSave as User);
    await this.invalidateUsersCache();
    return this.sanitizeUser(updatedUser);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing user ${id}`);
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.usersRepository.softDelete(user);
    await this.invalidateUsersCache();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findByLogin(login: string): Promise<User | null> {
    return this.usersRepository.findByLogin(login);
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
    const users = await this.usersRepository.getByIdsForUpdate(orderedIds);

    const sender = users.find((user) => user.id === fromUserId);
    if (!sender) {
      throw new NotFoundException(`User with ID ${fromUserId} not found`);
    }

    const receiver = users.find((user) => user.id === toUserId);
    if (!receiver) {
      throw new NotFoundException(`User with ID ${toUserId} not found`);
    }

    const amountCents = toCents(amount);
    const senderBalanceCents = toCents(sender.balance);
    const receiverBalanceCents = toCents(receiver.balance);
    const nextSenderBalanceCents = senderBalanceCents - amountCents;

    if (nextSenderBalanceCents < 0) {
      throw new BadRequestException('Insufficient balance');
    }

    sender.balance = toBalanceValue(nextSenderBalanceCents);
    receiver.balance = toBalanceValue(receiverBalanceCents + amountCents);

    await this.usersRepository.saveMany([sender, receiver]);
    await this.invalidateUsersCache();
  }

  async resetAllBalances(): Promise<void> {
    this.logger.log('Resetting balances for all active users');
    await this.usersRepository.resetBalancesForActiveUsers();
    await this.invalidateUsersCache();
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
