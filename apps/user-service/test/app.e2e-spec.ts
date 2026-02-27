import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import {
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(() => {
    initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];
    return request(httpServer).get('/').expect(200).expect('Hello World!');
  });
});
