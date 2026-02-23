import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../../users/entities/user.entity';
import { Role } from '../enums/role.enum';
import { JWT_STRATEGY } from '../constants';
import { USERS_REPOSITORY } from '../../users/ports/users-repository.port';
import type { UsersRepositoryPort } from '../../users/ports/users-repository.port';

export interface JwtPayload {
  sub: string;
  login: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JWT_STRATEGY) {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepositoryPort,
    configService: ConfigService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(
    payload: JwtPayload,
  ): Promise<Omit<User, 'password' | 'refreshToken'>> {
    const user = await this.usersRepository.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { password, refreshToken, ...safeUser } = user;
    void password;
    void refreshToken;
    return safeUser;
  }
}
