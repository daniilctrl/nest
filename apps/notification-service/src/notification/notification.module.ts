import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationGateway } from './notification.gateway';
import { NotificationController } from './notification.controller.js';

@Module({
  imports: [JwtModule.register({})],
  providers: [NotificationGateway],
  controllers: [NotificationController],
})
export class NotificationModule {}
