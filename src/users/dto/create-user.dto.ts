import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, IsInt, Min, Max, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../auth/enums/role.enum';

export class CreateUserDto {
  @ApiProperty({
    description: 'User login',
    minLength: 3,
    maxLength: 50,
    example: 'johndoe',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  login: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password',
    minLength: 6,
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'User age',
    minimum: 1,
    maximum: 150,
    example: 25,
  })
  @IsInt()
  @Min(1)
  @Max(150)
  age: number;

  @ApiProperty({
    description: 'User description',
    maxLength: 1000,
    example: 'Software developer from New York',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @ApiProperty({
    description: 'User role (only admins can set this)',
    enum: Role,
    example: Role.User,
    required: false,
    default: Role.User,
  })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
