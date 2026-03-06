import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationGateway } from './gateways/notification.gateway';
import { NotificationController } from './notification.controller';
import { NotificationKafkaController } from './controllers/kafka/notification-kafka.controller';
import { HttpJwtAuthGuard } from './guards/http-jwt-auth.guard';
import {
  TransferNotification,
  TransferNotificationSchema,
} from './schemas/transfer-notification.schema';
import { TransferNotificationsService } from './transfer-notifications.service';

@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: TransferNotification.name, schema: TransferNotificationSchema },
    ]),
  ],
  providers: [
    NotificationGateway,
    HttpJwtAuthGuard,
    TransferNotificationsService,
  ],
  controllers: [NotificationController, NotificationKafkaController],
})
export class NotificationModule {}
