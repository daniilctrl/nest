import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Avatar } from '../avatars/entities/avatar.entity';
import { HttpCacheInterceptor } from '../cache/http-cache.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([User, Avatar])],
  controllers: [UsersController],
  providers: [UsersService, HttpCacheInterceptor],
  exports: [UsersService],
})
export class UsersModule {}
