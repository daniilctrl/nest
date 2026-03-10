import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Avatar } from './entities/avatar.entity';
import { AvatarsService } from './avatars.service';
import { AvatarsController } from './avatars.controller';
import { FilesModule } from '../providers/files/files.module';

@Module({
  imports: [TypeOrmModule.forFeature([Avatar]), FilesModule],
  controllers: [AvatarsController],
  providers: [AvatarsService],
  exports: [AvatarsService],
})
export class AvatarsModule {}
