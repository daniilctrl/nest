import { NotificationKafkaController } from './notification-kafka.controller';
import { NotificationGateway } from './notification.gateway';

describe('NotificationKafkaController', () => {
  let controller: NotificationKafkaController;
  let notificationGateway: { sendNotification: jest.Mock };

  beforeEach(() => {
    notificationGateway = {
      sendNotification: jest.fn(),
    };

    controller = new NotificationKafkaController(
      notificationGateway as unknown as NotificationGateway,
    );
  });

  it('forwards direct payload to gateway', () => {
    controller.handleBalanceTransferred({
      eventId: 'evt-1',
      fromUserId: 'from-1',
      toUserId: 'to-1',
      amount: 10.5,
      transferredAt: '2026-03-03T10:00:00.000Z',
    });

    expect(notificationGateway.sendNotification).toHaveBeenCalledWith(
      'to-1',
      expect.objectContaining({
        type: 'balance_transferred',
        eventId: 'evt-1',
        fromUserId: 'from-1',
        toUserId: 'to-1',
        amount: 10.5,
      }),
    );
  });

  it('forwards nested value payload to gateway', () => {
    controller.handleBalanceTransferred({
      value: {
        eventId: 'evt-2',
        fromUserId: 'from-2',
        toUserId: 'to-2',
        amount: 1.25,
        transferredAt: '2026-03-03T11:00:00.000Z',
      },
    });

    expect(notificationGateway.sendNotification).toHaveBeenCalledWith(
      'to-2',
      expect.objectContaining({
        eventId: 'evt-2',
      }),
    );
  });

  it('ignores payload without toUserId', () => {
    controller.handleBalanceTransferred({
      eventId: 'evt-3',
      fromUserId: 'from-3',
      toUserId: '',
      amount: 2,
      transferredAt: '2026-03-03T11:00:00.000Z',
    });

    expect(notificationGateway.sendNotification).not.toHaveBeenCalled();
  });
});
