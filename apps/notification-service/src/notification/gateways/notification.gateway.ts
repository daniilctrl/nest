import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import type { MessageInDto } from '../dto/message-in.dto';
import type { MessageOutDto } from '../dto/message-out.dto';

@WebSocketGateway({
  namespace: '/notification',
  cors: { origin: '*' },
  transports: ['websocket'],
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log(`Gateway initialized: ${server.sockets.name}`);
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);

    try {
      const authHeader = client.handshake.headers.authorization;

      if (!authHeader || Array.isArray(authHeader)) {
        throw new Error('Authorization header is missing');
      }

      const [type, token] = authHeader.split(' ');

      if (type !== 'Bearer' || !token) {
        throw new Error('Invalid Authorization header format');
      }

      const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');

      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: jwtSecret,
      });

      if (!payload?.sub) {
        throw new Error('Token has no sub');
      }

      const userId = payload.sub;
      (client.data as { userId?: string }).userId = userId;

      void client.join(userId);

      client.emit('connected', { socketId: client.id });
    } catch (error: unknown) {
      this.logger.warn(
        `Invalid token for client ${client.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      void client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MessageInDto,
  ): void {
    const text = payload?.text?.trim();

    if (!text) {
      client.emit('message.error', { error: 'Text is required' });
      return;
    }

    const outgoingMessage: MessageOutDto = {
      id: randomUUID(),
      text,
      createdAt: new Date().toISOString(),
      senderSocketId: client.id,
    };

    this.server.emit('message', outgoingMessage);
  }

  sendNotification(userId: string, data: unknown): void {
    this.logger.log(`Sending notification to user ${userId}`);
    this.server.to(userId).emit('notification', data);
  }
}
