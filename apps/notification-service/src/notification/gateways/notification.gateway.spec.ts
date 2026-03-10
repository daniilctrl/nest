import { NotificationGateway } from './notification.gateway';
import { MessageInDto } from '../dto/message-in.dto';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('NotificationGateway', () => {
  let gateway: NotificationGateway;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let jwtVerifyMock: jest.Mock;
  let configGetMock: jest.Mock;

  beforeEach(() => {
    jwtVerifyMock = jest.fn();
    configGetMock = jest.fn();

    jwtService = {
      verify: jwtVerifyMock,
    } as unknown as jest.Mocked<JwtService>;

    configService = {
      get: configGetMock,
    } as unknown as jest.Mocked<ConfigService>;

    gateway = new NotificationGateway(jwtService, configService);
  });

  it('emits connected event on client connection', () => {
    configGetMock.mockReturnValue('secret');
    jwtVerifyMock.mockReturnValue({ sub: 'user-1' });

    const mockEmit = jest.fn();
    const mockJoin = jest.fn();
    const mockDisconnect = jest.fn();
    const mockClient = {
      id: 'socket-1',
      emit: mockEmit,
      join: mockJoin,
      disconnect: mockDisconnect,
      handshake: {
        headers: {
          authorization: 'Bearer token',
        },
      },
      data: {},
    } as unknown as Socket;

    gateway.handleConnection(mockClient);

    expect(configGetMock).toHaveBeenCalledWith('JWT_SECRET');
    expect(jwtVerifyMock).toHaveBeenCalledWith('token', {
      secret: 'secret',
    });

    expect(mockJoin).toHaveBeenCalledWith('user-1');
    expect(mockEmit).toHaveBeenCalledWith('connected', {
      socketId: 'socket-1',
    });
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('broadcasts message for valid payload', () => {
    const mockEmit = jest.fn();
    const mockServer = { emit: mockEmit } as unknown as Server;
    gateway.server = mockServer;

    const mockClient = { id: 'socket-1', emit: jest.fn() } as unknown as Socket;
    const payload: MessageInDto = { text: ' hello ' };

    gateway.handleMessage(mockClient, payload);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(
      'message',
      expect.objectContaining({
        text: 'hello',
        senderSocketId: 'socket-1',
      }),
    );
  });

  it('emits message.error for empty payload text', () => {
    const mockServerEmit = jest.fn();
    const mockServer = { emit: mockServerEmit } as unknown as Server;
    gateway.server = mockServer;

    const mockClientEmit = jest.fn();
    const mockClient = {
      id: 'socket-1',
      emit: mockClientEmit,
    } as unknown as Socket;

    gateway.handleMessage(mockClient, { text: '   ' });

    expect(mockClientEmit).toHaveBeenCalledWith('message.error', {
      error: 'Text is required',
    });
    expect(mockServerEmit).not.toHaveBeenCalled();
  });

  it('disconnects client on invalid token', () => {
    configGetMock.mockReturnValue('secret');
    jwtVerifyMock.mockImplementation(() => {
      throw new Error('invalid token');
    });

    const mockDisconnect = jest.fn();
    const mockClient = {
      id: 'socket-1',
      emit: jest.fn(),
      join: jest.fn(),
      disconnect: mockDisconnect,
      handshake: {
        headers: {
          authorization: 'Bearer bad-token',
        },
      },
      data: {},
    } as unknown as Socket;

    gateway.handleConnection(mockClient);

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('sends notification to specific user room', () => {
    const mockEmit = jest.fn();
    const mockTo = jest.fn(() => ({
      emit: mockEmit,
    }));
    const mockServer = { to: mockTo } as unknown as Server;
    gateway.server = mockServer;

    gateway.sendNotification('user-1', { data: 'test' });

    expect(mockTo).toHaveBeenCalledWith('user-1');
    expect(mockEmit).toHaveBeenCalledWith('notification', { data: 'test' });
  });
});
