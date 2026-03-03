import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationGateway } from './notification.gateway';
import { NotificationController } from './notification.controller';
import { NotificationKafkaController } from './notification-kafka.controller';
import { HttpJwtAuthGuard } from './guards/http-jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  providers: [NotificationGateway, HttpJwtAuthGuard],
  controllers: [NotificationController, NotificationKafkaController],
})
export class NotificationModule {}
