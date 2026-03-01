import { NotificationGateway } from './notification.gateway';
import { MessageInDto } from './dto/message-in.dto';
import { Server, Socket } from 'socket.io';

describe('NotificationGateway', () => {
  let gateway: NotificationGateway;

  beforeEach(() => {
    gateway = new NotificationGateway();
  });

  it('emits connected event on client connection', () => {
    const mockEmit = jest.fn();
    const mockClient = { id: 'socket-1', emit: mockEmit } as unknown as Socket;

    gateway.handleConnection(mockClient);

    expect(mockEmit).toHaveBeenCalledWith('connected', {
      socketId: 'socket-1',
    });
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
});
