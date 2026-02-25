import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional';

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

interface TokensResponseDto {
  accessToken: string;
  refreshToken: string;
}

describe('Auth flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs in, refreshes token and logs out', async () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const login = `user-${suffix}`;
    const email = `${login}@example.com`;
    const password = 'password123';

    const registerResponse = await request(httpServer)
      .post('/auth/register')
      .send({
        login,
        email,
        password,
        age: 25,
        description: 'e2e auth user',
      })
      .expect(201);

    const registerBody = registerResponse.body as unknown as AuthResponseDto;
    expect(registerBody.accessToken).toEqual(expect.any(String));
    expect(registerBody.refreshToken).toEqual(expect.any(String));
    expect(registerBody.user.login).toBe(login);
    expect(registerBody.user.email).toBe(email);

    const loginResponse = await request(httpServer)
      .post('/auth/login')
      .send({ login, password })
      .expect(200);

    const loginBody = loginResponse.body as unknown as AuthResponseDto;
    const accessToken = loginBody.accessToken;
    const refreshToken = loginBody.refreshToken;
    expect(accessToken).toEqual(expect.any(String));
    expect(refreshToken).toEqual(expect.any(String));

    const refreshResponse = await request(httpServer)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    const refreshBody = refreshResponse.body as unknown as TokensResponseDto;
    expect(refreshBody.accessToken).toEqual(expect.any(String));
    expect(refreshBody.refreshToken).toEqual(expect.any(String));

    await request(httpServer)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});
