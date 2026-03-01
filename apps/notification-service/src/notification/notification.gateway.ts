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
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import type { MessageInDto } from './dto/message-in.dto';
import type { MessageOutDto } from './dto/message-out.dto';

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

  afterInit(server: Server): void {
    this.logger.log(`Gateway initialized: ${server.sockets.name}`);
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected', { socketId: client.id });
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
}
