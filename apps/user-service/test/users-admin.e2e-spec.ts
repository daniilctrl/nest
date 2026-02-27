import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Role } from '../src/auth/enums/role.enum';

interface AuthUserDto {
  id: string;
  login: string;
  email: string;
  age: number;
  description: string;
}

interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

interface UserDto {
  id: string;
  login: string;
  email: string;
  age: number;
  description: string;
  balance: string;
  role: Role;
}

interface PaginatedUsersDto {
  data: UserDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

describe('Users admin endpoints (e2e)', () => {
  let app: INestApplication;
  let usersRepository: Repository<User>;
  let httpServer: Parameters<typeof request>[0];

  const makeSuffix = () =>
    `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const register = async (suffix: string): Promise<AuthResponseDto> => {
    const login = `user-${suffix}`;
    const response = await request(httpServer)
      .post('/auth/register')
      .send({
        login,
        email: `${login}@example.com`,
        password: 'password123',
        age: 28,
        description: `e2e user ${suffix}`,
      })
      .expect(201);

    return response.body as AuthResponseDto;
  };

  const login = async (
    userLogin: string,
    password = 'password123',
  ): Promise<AuthResponseDto> => {
    const response = await request(httpServer)
      .post('/auth/login')
      .send({ login: userLogin, password })
      .expect(200);
    return response.body as AuthResponseDto;
  };

  const createAdminSession = async (): Promise<{
    token: string;
    admin: AuthUserDto;
  }> => {
    const suffix = `admin-${makeSuffix()}`;
    const registered = await register(suffix);
    await usersRepository.update(registered.user.id, { role: Role.Admin });
    const loggedIn = await login(registered.user.login);
    return { token: loggedIn.accessToken, admin: loggedIn.user };
  };

  beforeAll(async () => {
    initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    httpServer = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];
    usersRepository = app.get(DataSource).getRepository(User);
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows admin to CRUD users through /users endpoints', async () => {
    const { token } = await createAdminSession();
    const managedSuffix = `managed-${makeSuffix()}`;
    const managedLogin = `managed-${managedSuffix}`;

    const createResponse = await request(httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        login: managedLogin,
        email: `${managedLogin}@example.com`,
        password: 'password123',
        age: 31,
        description: 'managed by admin',
        role: Role.User,
      })
      .expect(201);

    const createdUser = createResponse.body as UserDto;
    expect(createdUser.id).toEqual(expect.any(String));
    expect(createdUser.login).toBe(managedLogin);
    expect((createdUser as Partial<User>).password).toBeUndefined();

    const listResponse = await request(httpServer)
      .get(`/users?login=${managedLogin}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const listBody = listResponse.body as PaginatedUsersDto;
    expect(Array.isArray(listBody.data)).toBe(true);
    expect(listBody.data.some((user) => user.id === createdUser.id)).toBe(true);

    const getResponse = await request(httpServer)
      .get(`/users/${createdUser.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const fetchedUser = getResponse.body as UserDto;
    expect(fetchedUser.id).toBe(createdUser.id);

    const updatedDescription = `updated-${makeSuffix()}`;
    const patchResponse = await request(httpServer)
      .patch(`/users/${createdUser.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: updatedDescription })
      .expect(200);
    const patchedUser = patchResponse.body as UserDto;
    expect(patchedUser.description).toBe(updatedDescription);

    await request(httpServer)
      .delete(`/users/${createdUser.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('returns 403 for non-admin on admin users endpoints', async () => {
    const regular = await register(`regular-${makeSuffix()}`);

    await request(httpServer)
      .get('/users')
      .set('Authorization', `Bearer ${regular.accessToken}`)
      .expect(403);
  });

  it('processes transfer successfully for admin', async () => {
    const { token } = await createAdminSession();
    const senderSuffix = `sender-${makeSuffix()}`;
    const receiverSuffix = `receiver-${makeSuffix()}`;
    const senderLogin = `sender-${senderSuffix}`;
    const receiverLogin = `receiver-${receiverSuffix}`;

    const senderResponse = await request(httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        login: senderLogin,
        email: `${senderLogin}@example.com`,
        password: 'password123',
        age: 30,
        description: 'sender',
        role: Role.User,
      })
      .expect(201);
    const receiverResponse = await request(httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        login: receiverLogin,
        email: `${receiverLogin}@example.com`,
        password: 'password123',
        age: 30,
        description: 'receiver',
        role: Role.User,
      })
      .expect(201);

    const sender = senderResponse.body as UserDto;
    const receiver = receiverResponse.body as UserDto;

    await usersRepository.update(sender.id, { balance: '10.00' });
    await usersRepository.update(receiver.id, { balance: '1.00' });

    await request(httpServer)
      .post('/users/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 2.35,
      })
      .expect(201);

    const updatedSender = await usersRepository.findOneOrFail({
      where: { id: sender.id },
    });
    const updatedReceiver = await usersRepository.findOneOrFail({
      where: { id: receiver.id },
    });

    expect(updatedSender.balance).toBe('7.65');
    expect(updatedReceiver.balance).toBe('3.35');
  });

  it('returns expected transfer errors (same user, insufficient balance, missing sender)', async () => {
    const { token } = await createAdminSession();
    const senderSuffix = `sender-err-${makeSuffix()}`;
    const receiverSuffix = `receiver-err-${makeSuffix()}`;
    const senderLogin = `sender-err-${senderSuffix}`;
    const receiverLogin = `receiver-err-${receiverSuffix}`;

    const senderResponse = await request(httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        login: senderLogin,
        email: `${senderLogin}@example.com`,
        password: 'password123',
        age: 30,
        description: 'sender for errors',
        role: Role.User,
      })
      .expect(201);
    const receiverResponse = await request(httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        login: receiverLogin,
        email: `${receiverLogin}@example.com`,
        password: 'password123',
        age: 30,
        description: 'receiver for errors',
        role: Role.User,
      })
      .expect(201);

    const sender = senderResponse.body as UserDto;
    const receiver = receiverResponse.body as UserDto;

    await usersRepository.update(sender.id, { balance: '1.00' });

    await request(httpServer)
      .post('/users/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fromUserId: sender.id,
        toUserId: sender.id,
        amount: 0.5,
      })
      .expect(400);

    await request(httpServer)
      .post('/users/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fromUserId: sender.id,
        toUserId: receiver.id,
        amount: 2.0,
      })
      .expect(400);

    await request(httpServer)
      .post('/users/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fromUserId: '11111111-1111-1111-1111-111111111111',
        toUserId: receiver.id,
        amount: 0.5,
      })
      .expect(404);
  });
});
