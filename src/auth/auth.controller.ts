import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiBearerAuth, 
  ApiCreatedResponse, 
  ApiOkResponse, 
  ApiBadRequestResponse, 
  ApiConflictResponse, 
  ApiUnauthorizedResponse 
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({ description: 'User successfully registered' })
  @ApiBadRequestResponse({ description: 'Bad request - validation failed' })
  @ApiConflictResponse({ description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiOkResponse({ description: 'User successfully logged in' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshTokenGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiOkResponse({ description: 'Token successfully refreshed' })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  async refreshTokens(@CurrentUser() user: User, @Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(user.id, refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout user' })
  @ApiOkResponse({ description: 'User successfully logged out' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async logout(@CurrentUser() user: User) {
    await this.authService.logout(user.id);
    return { message: 'Logged out successfully' };
  }
}
