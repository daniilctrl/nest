import {
  Body,
  Controller,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { NotificationGateway } from './gateways/notification.gateway';
import { SendNotificationDto } from './dto/send-notification.dto';
import { HttpJwtAuthGuard } from './guards/http-jwt-auth.guard';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationGateway: NotificationGateway) {}

  @Post()
  @UseGuards(HttpJwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
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
