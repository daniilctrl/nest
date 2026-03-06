import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  BALANCE_TRANSFERRED_TOPIC,
  type BalanceTransferredEvent,
} from '@app/shared';
import { NotificationGateway } from '../../gateways/notification.gateway';
import { TransferNotificationsService } from '../../transfer-notifications.service';

@Controller()
export class NotificationKafkaController {
  private readonly logger = new Logger(NotificationKafkaController.name);

  constructor(
    @Inject(NotificationGateway)
    private readonly notificationGateway: NotificationGateway,
    private readonly transferNotificationsService: TransferNotificationsService,
  ) {}

  @EventPattern(BALANCE_TRANSFERRED_TOPIC)
  async handleBalanceTransferred(
    @Payload()
    payload: BalanceTransferredEvent | { value?: BalanceTransferredEvent },
  ): Promise<void> {
    const event = this.extractEvent(payload);

    if (!event?.toUserId) {
      this.logger.warn('Kafka event ignored: toUserId is missing');
      return;
    }

    const socketPayload = {
      type: 'balance_transferred',
      eventId: event.eventId,
      fromUserId: event.fromUserId,
      toUserId: event.toUserId,
      amount: event.amount,
      transferredAt: event.transferredAt,
    };

    const persistPromise =
      this.transferNotificationsService.createFromEvent(event);

    this.notificationGateway.sendNotification(event.toUserId, socketPayload);

    try {
      await persistPromise;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to persist transfer notification (eventId=${event.eventId})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private extractEvent(
    payload: BalanceTransferredEvent | { value?: BalanceTransferredEvent },
  ): BalanceTransferredEvent | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    if ('value' in payload && payload.value) {
      return payload.value;
    }

    return payload as BalanceTransferredEvent;
  }
}
