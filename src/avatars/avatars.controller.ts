import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { AvatarsService } from './avatars.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Avatar } from './entities/avatar.entity';
import type { IUploadedMulterFile } from '../providers/files/s3/interfaces/upload-file.interface';

@ApiTags('Avatars')
@Controller('avatars')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AvatarsController {
  constructor(private readonly avatarsService: AvatarsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active avatars of current user' })
  @ApiOkResponse({ description: 'List of active avatars' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  findAll(@CurrentUser() user: User): Promise<Avatar[]> {
    return this.avatarsService.findAllByUserId(user.id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload avatar for current user' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image file' },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({ description: 'Avatar uploaded successfully' })
  @ApiBadRequestResponse({
    description: 'Validation failed or max active avatars (5) reached',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: IUploadedMulterFile,
  ): Promise<Avatar> {
    return this.avatarsService.uploadAvatar(user.id, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete own avatar (soft delete)' })
  @ApiParam({ name: 'id', description: 'Avatar ID' })
  @ApiOkResponse({ description: 'Avatar deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Cannot delete another user avatar' })
  @ApiNotFoundResponse({ description: 'Avatar not found' })
  removeAvatar(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.avatarsService.removeAvatar(id, user.id);
  }
}
