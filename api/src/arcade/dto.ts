import {
  Allow,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitArcadeScoreDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  gameId!: string;

  @IsString()
  @MinLength(16)
  @MaxLength(128)
  clientKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  nick?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3600_000 * 500)
  playMs!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  sessions!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(64)
  badges!: number;
}

export class SubmitArcadeRatingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  gameId!: string;

  @IsString()
  @MinLength(16)
  @MaxLength(128)
  clientKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}

export class UpdateArcadeGalleryStatusDto {
  @IsEnum(['pending', 'published', 'rejected'] as const)
  status!: 'pending' | 'published' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  rejectReason?: string;
}

export class UpdateArcadeScoreAdminDto {
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  nick?: string;
}

export class ImportArcadeDto {
  /** 前台提交的 games-page.json；省略则尝试读静态文件 */
  @IsOptional()
  @Allow()
  page?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}

export class UpsertArcadeVisitorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  nick!: string;
}
