import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { NotificationServiceModule } from './../src/notification-service.module';

describe('NotificationServiceController (e2e)', () => {
  let app: INestApplication;
  let port: number;
  const jwtSecret = 'test-jwt-secret';
  const jwtService = new JwtService();
  const createAuthHeader = (userId = 'user-1'): string => {
    const token = jwtService.sign({ sub: userId }, { secret: jwtSecret });
    return `Bearer ${token}`;
  };

  beforeEach(async () => {
    process.env.JWT_SECRET = jwtSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [NotificationServiceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    const httpServer = app.getHttpServer() as Server;
    const address = httpServer.address();

    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve test HTTP server address');
    }

    port = address.port;
  });

  afterEach(async () => {
    await app.close();
  });

  const createSocketClient = (userId = 'user-1'): Socket => {
    return io(`http://127.0.0.1:${port}/notification`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
      extraHeaders: {
        authorization: createAuthHeader(userId),
      },
    });
  };

  const waitForEvent = <T>(
    socket: Socket,
    event: string,
    timeoutMs = 5000,
  ): Promise<T> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${event}`));
      }, timeoutMs);

      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  it('/ (GET)', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    await request(httpServer).get('/').expect(200).expect('Hello World!');
  });

  it('rejects notification send without auth header', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    await request(httpServer)
      .post('/notifications')
      .send({ userId: 'user-2', payload: { data: 'hello' } })
      .expect(401);
  });

  it('rejects notification send with invalid body', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    await request(httpServer)
      .post('/notifications')
      .set('Authorization', createAuthHeader())
      .send({ payload: { data: 'hello' } })
      .expect(400);
  });

  it('sends notification via http endpoint for authorized caller', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    await request(httpServer)
      .post('/notifications')
      .set('Authorization', createAuthHeader())
      .send({ userId: 'user-2', payload: { data: 'hello' } })
      .expect(201)
      .expect({ status: 'ok' });
  });

  it('connects to notification namespace and receives connected event', async () => {
    const client = createSocketClient();

    try {
      const connectedPayload = await waitForEvent<{ socketId: string }>(
        client,
        'connected',
      );

      expect(connectedPayload.socketId).toBeTruthy();
    } finally {
      client.disconnect();
    }
  });

  it('broadcasts message payload to all connected clients', async () => {
    const clientA = createSocketClient();
    const clientB = createSocketClient('user-2');

    try {
      await Promise.all([
        waitForEvent<{ socketId: string }>(clientA, 'connected'),
        waitForEvent<{ socketId: string }>(clientB, 'connected'),
      ]);

      const clientAMessagePromise = waitForEvent<{
        id: string;
        text: string;
        createdAt: string;
        senderSocketId: string;
      }>(clientA, 'message');
      const clientBMessagePromise = waitForEvent<{
        id: string;
        text: string;
        createdAt: string;
        senderSocketId: string;
      }>(clientB, 'message');

      clientA.emit('message', { text: 'hello' });

      const [messageA, messageB] = await Promise.all([
        clientAMessagePromise,
        clientBMessagePromise,
      ]);

      expect(messageA.text).toBe('hello');
      expect(messageA.senderSocketId).toBe(clientA.id);
      expect(messageA.id).toBeTruthy();
      expect(messageA.createdAt).toBeTruthy();

      expect(messageB.text).toBe('hello');
      expect(messageB.senderSocketId).toBe(clientA.id);
      expect(messageB.id).toBeTruthy();
      expect(messageB.createdAt).toBeTruthy();
    } finally {
      clientA.disconnect();
      clientB.disconnect();
    }
  });
});
