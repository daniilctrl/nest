import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    login: string;
    email: string;
    age: number;
    description: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existingUserByLogin = await this.usersRepository.findOne({
      where: { login: registerDto.login },
    });

    if (existingUserByLogin) {
      throw new ConflictException('User with this login already exists');
    }

    const existingUserByEmail = await this.usersRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUserByEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = this.usersRepository.create({
      login: registerDto.login,
      email: registerDto.email,
      password: hashedPassword,
      age: registerDto.age,
      description: registerDto.description,
    });

    const savedUser = await this.usersRepository.save(user);

    const tokens = await this.generateTokens(savedUser.id, savedUser.login);
    await this.updateRefreshToken(savedUser.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: savedUser.id,
        login: savedUser.login,
        email: savedUser.email,
        age: savedUser.age,
        description: savedUser.description,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersRepository.findOne({
      where: { login: loginDto.login },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.login);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        age: user.age,
        description: user.description,
      },
    };
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user.id, user.login);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.usersRepository.update(userId, { refreshToken: undefined });
  }

  private async generateTokens(userId: string, login: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, login };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersRepository.update(userId, { refreshToken: hashedRefreshToken });
  }
}
