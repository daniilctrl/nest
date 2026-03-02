import { Body, Controller, Post } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';

class SendNotificationDto {
  userId!: string;
  payload?: unknown;
}

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationGateway: NotificationGateway) {}

  @Post()
  send(@Body() body: SendNotificationDto) {
    const { userId, payload } = body;

    this.notificationGateway.sendNotification(
      userId,
      payload ?? {
        data: 'hello!',
      },
    );

    return { status: 'ok' };
  }
}
