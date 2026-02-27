import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/entities/user.entity';
import { Avatar } from './avatars/entities/avatar.entity';
import { AvatarsModule } from './avatars/avatars.module';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';
import { BullModule } from '@nestjs/bullmq';
import { BalanceResetModule } from './balance-reset/balance-reset.module';
import {
  getBullModuleOptions,
  getCacheModuleOptions,
} from './common/config/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getCacheModuleOptions(configService),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getBullModuleOptions(configService),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),
          entities: [User, Avatar],
          synchronize: true,
        };
      },
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('TypeORM options are not provided');
        }
        const dataSource = new DataSource(options);
        await dataSource.initialize();
        return addTransactionalDataSource(dataSource);
      },
    }),
    UsersModule,
    AuthModule,
    AvatarsModule,
    BalanceResetModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
