import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../auth/enums/role.enum';
import { Avatar } from '../avatars/entities/avatar.entity';
import { AVATARS_REPOSITORY } from '../avatars/ports/avatars-repository.port';
import type { AvatarsRepositoryPort } from '../avatars/ports/avatars-repository.port';
import { User } from './entities/user.entity';
import { USERS_REPOSITORY } from './ports/users-repository.port';
import type { UsersRepositoryPort } from './ports/users-repository.port';
import { UsersService } from './users.service';

jest.mock('typeorm-transactional', () => {
  return {
    Transactional:
      () =>
      (
        _target: unknown,
        _propertyKey: string,
        descriptor: PropertyDescriptor,
      ) =>
        descriptor,
  };
});

type MockUsersRepository = jest.Mocked<UsersRepositoryPort>;
type MockAvatarsRepository = jest.Mocked<AvatarsRepositoryPort>;

const makeUser = (params: Partial<User> = {}): User =>
  ({
    id: params.id ?? 'user-id',
    login: params.login ?? 'login',
    email: params.email ?? 'user@example.com',
    password: params.password ?? 'hashed-password',
    age: params.age ?? 30,
    description: params.description ?? 'desc',
    balance: params.balance ?? '0.00',
    role: params.role ?? Role.User,
    refreshToken: params.refreshToken ?? null,
    createdAt: params.createdAt ?? new Date(),
    updatedAt: params.updatedAt ?? new Date(),
    deletedAt: params.deletedAt ?? null,
  }) as User;

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: MockUsersRepository;
  let avatarsRepository: MockAvatarsRepository;
  const cacheManager = {
    clear: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    usersRepository = {
      findById: jest.fn(),
      findByLogin: jest.fn(),
      findByEmail: jest.fn(),
      createAndSave: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
      updateById: jest.fn(),
      softDelete: jest.fn(),
      findPaginated: jest.fn(),
      findMostActive: jest.fn(),
      getByIdsForUpdate: jest.fn(),
      resetBalancesForActiveUsers: jest.fn(),
    };

    avatarsRepository = {
      findLastActiveByUserIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: USERS_REPOSITORY, useValue: usersRepository },
        { provide: AVATARS_REPOSITORY, useValue: avatarsRepository },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated most-active users with last avatar', async () => {
    const user1 = makeUser({ id: 'u1', balance: '10.00' });
    const user2 = makeUser({ id: 'u2', balance: '20.00' });
    const lastAvatar = { id: 'a1', userId: 'u1' } as Avatar;
    usersRepository.findMostActive.mockResolvedValue({
      users: [user1, user2],
      total: 2,
    });
    avatarsRepository.findLastActiveByUserIds.mockResolvedValue(
      new Map([['u1', lastAvatar]]),
    );

    const result = await service.findMostActiveUsers({
      ageMin: 18,
      ageMax: 60,
      page: 1,
      limit: 20,
    });

    expect(usersRepository.findMostActive.mock.calls[0]?.[0]).toEqual({
      ageMin: 18,
      ageMax: 60,
      page: 1,
      limit: 20,
      minActiveAvatars: 2,
    });
    expect(
      avatarsRepository.findLastActiveByUserIds.mock.calls[0]?.[0],
    ).toEqual(['u1', 'u2']);
    expect(result.total).toBe(2);
    expect(result.data[0].lastAvatar).toBe(lastAvatar);
    expect(result.data[1].lastAvatar).toBeNull();
    expect((result.data[0].user as Partial<User>).password).toBeUndefined();
    expect((result.data[0].user as Partial<User>).refreshToken).toBeUndefined();
  });

  it('throws on invalid age range in findMostActiveUsers', async () => {
    await expect(
      service.findMostActiveUsers({
        ageMin: 50,
        ageMax: 20,
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when transfer sender does not exist', async () => {
    usersRepository.getByIdsForUpdate.mockResolvedValue([
      makeUser({ id: 'receiver-id' }),
    ]);

    await expect(
      service.transferBalance({
        fromUserId: 'sender-id',
        toUserId: 'receiver-id',
        amount: 10,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('transfers balance with rounding to cents', async () => {
    const sender = makeUser({ id: 'u1', balance: '100.05' });
    const receiver = makeUser({ id: 'u2', balance: '1.10' });
    usersRepository.getByIdsForUpdate.mockResolvedValue([sender, receiver]);
    usersRepository.saveMany.mockImplementation((users) =>
      Promise.resolve(users),
    );

    await service.transferBalance({
      fromUserId: 'u1',
      toUserId: 'u2',
      amount: 0.15,
    });

    expect(usersRepository.getByIdsForUpdate.mock.calls[0]?.[0]).toEqual([
      'u1',
      'u2',
    ]);
    expect(usersRepository.saveMany.mock.calls).toHaveLength(1);
    const savedUsers = usersRepository.saveMany.mock.calls[0][0];
    const savedSender = savedUsers.find((user) => user.id === 'u1');
    const savedReceiver = savedUsers.find((user) => user.id === 'u2');
    expect(savedSender?.balance).toBe('99.90');
    expect(savedReceiver?.balance).toBe('1.25');
    expect(cacheManager.clear).toHaveBeenCalledTimes(1);
  });
});
