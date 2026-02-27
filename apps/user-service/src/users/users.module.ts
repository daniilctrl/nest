import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Avatar } from '../avatars/entities/avatar.entity';
import { HttpCacheInterceptor } from '../cache/http-cache.interceptor';
import { USERS_REPOSITORY } from './ports/users-repository.port';
import { TypeOrmUsersRepository } from './repositories/typeorm-users.repository';
import { AVATARS_REPOSITORY } from '../avatars/ports/avatars-repository.port';
import { TypeOrmAvatarsRepository } from '../avatars/repositories/typeorm-avatars.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User, Avatar])],
  controllers: [UsersController],
  providers: [
    UsersService,
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
