import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { User } from '../../users/entities/user.entity';
import { JwtPayload } from './jwt.strategy';
import { JWT_REFRESH_STRATEGY } from '../constants';
import { USERS_REPOSITORY } from '../../users/ports/users-repository.port';
import type { UsersRepositoryPort } from '../../users/ports/users-repository.port';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  JWT_REFRESH_STRATEGY,
) {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepositoryPort,
    configService: ConfigService,
  ) {
    const jwtRefreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!jwtRefreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: jwtRefreshSecret,
      passReqToCallback: true,
    });
  }

  async validate(
    _req: Request,
    payload: JwtPayload,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.usersRepository.findById(payload.sub);

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
