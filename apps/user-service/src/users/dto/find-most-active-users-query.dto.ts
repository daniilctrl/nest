import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class FindMostActiveUsersQueryDto {
  @ApiProperty({
    description: 'Minimum age (inclusive)',
    example: 18,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(150)
  ageMin: number;

  @ApiProperty({
    description: 'Maximum age (inclusive)',
    example: 99,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(150)
  ageMax: number;

  @ApiProperty({
    description: 'Page number (starts from 1)',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
