import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, IsInt, Min, Max } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  login: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsInt()
  @Min(1)
  @Max(150)
  age: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;
}
