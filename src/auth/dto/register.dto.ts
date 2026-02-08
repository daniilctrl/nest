import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
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
}
