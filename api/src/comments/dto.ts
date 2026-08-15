import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  path!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  author!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  website?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;
}

export class UpdateCommentStatusDto {
  @IsEnum(['pending', 'published'] as const)
  status!: 'pending' | 'published';
}
