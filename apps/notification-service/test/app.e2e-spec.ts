import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { NotificationServiceModule } from './../src/notification-service.module';

describe('NotificationServiceController (e2e)', () => {
  let app: INestApplication;
  let port: number;

  beforeEach(async () => {
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

  const createSocketClient = (): Socket =>
    io(`http://127.0.0.1:${port}/notification`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
    });

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
    const clientB = createSocketClient();

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
