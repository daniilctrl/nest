import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from './enums/role.enum';
import { hashPassword, comparePasswords } from '../common/utils/password.util';
import { USERS_REPOSITORY } from '../users/ports/users-repository.port';
import type { UsersRepositoryPort } from '../users/ports/users-repository.port';

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepositoryPort,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    this.logger.log(`Register request for login "${registerDto.login}"`);
    const existingUserByLogin = await this.usersRepository.findByLogin(
      registerDto.login,
    );

    if (existingUserByLogin) {
      throw new ConflictException('User with this login already exists');
    }

    const existingUserByEmail = await this.usersRepository.findByEmail(
      registerDto.email,
    );

    if (existingUserByEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await hashPassword(registerDto.password);

    const savedUser = await this.usersRepository.createAndSave({
      login: registerDto.login,
      email: registerDto.email,
      password: hashedPassword,
      age: registerDto.age,
      description: registerDto.description,
    });

    const tokens = await this.generateTokens(
      savedUser.id,
      savedUser.login,
      savedUser.role,
    );
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
    this.logger.log(`Login request for login "${loginDto.login}"`);
    const user = await this.usersRepository.findByLogin(loginDto.login);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await comparePasswords(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.login, user.role);
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

  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    this.logger.debug(`Refreshing token for user ${userId}`);
    const user = await this.usersRepository.findById(userId);

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const isRefreshTokenValid = await comparePasswords(
      refreshToken,
      user.refreshToken,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user.id, user.login, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    this.logger.log(`Logout request for user ${userId}`);
    await this.usersRepository.updateById(userId, { refreshToken: null });
  }

  private async generateTokens(
    userId: string,
    login: string,
    role: Role,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const jwtRefreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not set');
    }

    if (!jwtRefreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not set');
    }

    const payload = { sub: userId, login, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtRefreshSecret,
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async updateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedRefreshToken = await hashPassword(refreshToken);
    await this.usersRepository.updateById(userId, {
      refreshToken: hashedRefreshToken,
    });
  }
}
