import { NotificationKafkaController } from './notification-kafka.controller';
import { NotificationGateway } from '../../gateways/notification.gateway';
import { TransferNotificationsService } from '../../transfer-notifications.service';

describe('NotificationKafkaController', () => {
  let controller: NotificationKafkaController;
  let notificationGateway: { sendNotification: jest.Mock };
  let transferNotificationsService: { createFromEvent: jest.Mock };

  beforeEach(() => {
    notificationGateway = {
      sendNotification: jest.fn(),
    };
    transferNotificationsService = {
      createFromEvent: jest.fn().mockResolvedValue(undefined),
    };

    controller = new NotificationKafkaController(
      notificationGateway as unknown as NotificationGateway,
      transferNotificationsService as unknown as TransferNotificationsService,
    );
  });

  it('forwards direct payload to gateway and persists notification', async () => {
    await controller.handleBalanceTransferred({
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

    expect(transferNotificationsService.createFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-1',
      }),
    );
  });

  it('forwards nested value payload to gateway', async () => {
    await controller.handleBalanceTransferred({
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

  it('ignores payload without toUserId', async () => {
    await controller.handleBalanceTransferred({
      eventId: 'evt-3',
      fromUserId: 'from-3',
      toUserId: '',
      amount: 2,
      transferredAt: '2026-03-03T11:00:00.000Z',
    });

    expect(notificationGateway.sendNotification).not.toHaveBeenCalled();
    expect(transferNotificationsService.createFromEvent).not.toHaveBeenCalled();
  });

  it('still sends websocket notification when persistence fails', async () => {
    transferNotificationsService.createFromEvent.mockRejectedValueOnce(
      new Error('mongo down'),
    );

    await controller.handleBalanceTransferred({
      eventId: 'evt-4',
      fromUserId: 'from-4',
      toUserId: 'to-4',
      amount: 5.75,
      transferredAt: '2026-03-03T12:00:00.000Z',
    });

    expect(notificationGateway.sendNotification).toHaveBeenCalledWith(
      'to-4',
      expect.objectContaining({
        eventId: 'evt-4',
      }),
    );
  });
});
