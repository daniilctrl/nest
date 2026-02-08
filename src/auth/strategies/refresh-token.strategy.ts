import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { JwtPayload } from './jwt.strategy';
import { JWT_REFRESH_STRATEGY } from '../constants';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, JWT_REFRESH_STRATEGY) {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: JwtPayload): Promise<Omit<User, 'password'>> {
    const refreshToken = req.body.refreshToken;
    
    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
