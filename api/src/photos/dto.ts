import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class PhotoStoryMusicDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  neteaseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  artist?: string;
}

export class PhotoStoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  intro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  device?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  timeLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  locationLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  weather?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  authorBio?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PhotoStoryMusicDto)
  music?: PhotoStoryMusicDto | null;
}

export class CreatePhotoAlbumDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  date?: string;
}

export class UpdatePhotoAlbumDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  theme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  cover?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  date?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PhotoStoryDto)
  story?: PhotoStoryDto | null;
}

export class UpdatePhotoAssetDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  device?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber()
  lat?: number | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber()
  lng?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  albumKey?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PhotoStoryDto)
  story?: PhotoStoryDto | null;
}

export class SyncPhotosDto {
  /** 可选：直接传入索引 JSON；否则服务端读 photowall-index.json */
  @IsOptional()
  @IsObject()
  index?: Record<string, unknown>;

  /**
   * 同步后删除索引里已不存在的照片/空相册（改名、重分类后避免重复与灰图）。
   * 默认 true。
   */
  @IsOptional()
  @IsBoolean()
  prune?: boolean;
}
