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

  async createFromEvent(event: BalanceTransferredEvent): Promise<void> {
    await this.transferNotificationModel.create({
      fromUserId: event.fromUserId,
      toUserId: event.toUserId,
      amount: event.amount,
      transferredAt: new Date(event.transferredAt),
    });

    this.logger.log(
      `Transfer notification persisted (eventId=${event.eventId}, toUserId=${event.toUserId})`,
    );
  }
}
