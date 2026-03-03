import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  BALANCE_TRANSFERRED_TOPIC,
  type BalanceTransferredEvent,
} from '@app/shared';
import { NotificationGateway } from './notification.gateway';

@Controller()
export class NotificationKafkaController {
  private readonly logger = new Logger(NotificationKafkaController.name);

  constructor(
    @Inject(NotificationGateway)
    private readonly notificationGateway: NotificationGateway,
  ) {}

  @EventPattern(BALANCE_TRANSFERRED_TOPIC)
  handleBalanceTransferred(
    @Payload()
    payload: BalanceTransferredEvent | { value?: BalanceTransferredEvent },
  ): void {
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

    this.notificationGateway.sendNotification(event.toUserId, socketPayload);
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
