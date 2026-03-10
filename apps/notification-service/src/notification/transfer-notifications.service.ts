import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BalanceTransferredEvent } from '@app/shared';
import {
  TransferNotification,
  TransferNotificationDocument,
} from './schemas/transfer-notification.schema';

@Injectable()
export class TransferNotificationsService {
  private readonly logger = new Logger(TransferNotificationsService.name);

  constructor(
    @InjectModel(TransferNotification.name)
    private readonly transferNotificationModel: Model<TransferNotificationDocument>,
  ) {}

  async createFromEvent(event: BalanceTransferredEvent): Promise<boolean> {
    try {
      await this.transferNotificationModel.create({
        eventId: event.eventId,
        fromUserId: event.fromUserId,
        toUserId: event.toUserId,
        amount: event.amount,
        transferredAt: new Date(event.transferredAt),
      });

      this.logger.log(
        `Transfer notification persisted (eventId=${event.eventId}, toUserId=${event.toUserId})`,
      );
      return true;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as Record<string, unknown>).code === 11000
      ) {
        this.logger.warn(`Duplicate event ignored (eventId=${event.eventId})`);
        return false;
      }
      throw error;
    }
  }
}
