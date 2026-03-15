import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Avatar } from '../avatars/entities/avatar.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { HttpCacheInterceptor } from '../cache/http-cache.interceptor';
import { USERS_REPOSITORY } from './ports/users-repository.port';
import { TypeOrmUsersRepository } from './repositories/typeorm-users.repository';
import { AVATARS_REPOSITORY } from '../avatars/ports/avatars-repository.port';
import { TypeOrmAvatarsRepository } from '../avatars/repositories/typeorm-avatars.repository';
import { USERS_KAFKA_CLIENT } from './users.constants';
import { UsersEventsPublisher } from './events/users-events.publisher';
import { OutboxProcessor } from './processors/outbox.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Avatar, OutboxEvent]),
    ClientsModule.registerAsync([
      {
        name: USERS_KAFKA_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const brokersRaw = configService.getOrThrow<string>('KAFKA_BROKERS');
          const clientId = configService.getOrThrow<string>(
            'KAFKA_CLIENT_ID_USER_SERVICE',
          );

          const brokers = brokersRaw
            .split(',')
            .map((broker) => broker.trim())
            .filter(Boolean);

          if (brokers.length === 0) {
            throw new Error('KAFKA_BROKERS must contain at least one broker');
          }

          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId,
                brokers,
              },
              producer: {
                allowAutoTopicCreation: true,
              },
            },
          };
        },
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersEventsPublisher,
    OutboxProcessor,
    HttpCacheInterceptor,
    TypeOrmUsersRepository,
    TypeOrmAvatarsRepository,
    {
      provide: USERS_REPOSITORY,
      useExisting: TypeOrmUsersRepository,
    },
    {
      provide: AVATARS_REPOSITORY,
      useExisting: TypeOrmAvatarsRepository,
    },
  ],
  exports: [UsersService, USERS_REPOSITORY],
})
export class UsersModule {}
