import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const KINDS = [
  'book',
  'novel',
  'manga',
  'game',
  'anime',
  'movie',
  'drama',
  'variety',
] as const;
const STATUSES = ['reading', 'finished', 'planned', 'dropped'] as const;

export class CreateLibraryItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @IsOptional()
  @IsIn(KINDS)
  type?: (typeof KINDS)[number];

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(800)
  cover?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  progress?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  progressCurrent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  progressTotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  year?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  genre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  thoughts?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  quotes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  takeaways?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  updated?: string;
}

export class UpdateLibraryItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @IsOptional()
  @IsIn(KINDS)
  type?: (typeof KINDS)[number];

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(800)
  cover?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  progress?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  progressCurrent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  progressTotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  year?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  genre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  thoughts?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  quotes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  takeaways?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  updated?: string;
}

export class ImportLibraryDto {
  @IsOptional()
  @IsObject()
  index?: { items?: unknown[] } | unknown[];

  @IsOptional()
  @IsBoolean()
  prune?: boolean;

  /** true 时覆盖已有条目（仍尽量保留想法/摘句）；默认跳过已有 */
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}
