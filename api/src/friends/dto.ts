import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateFriendApplicationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'avatar must be a URL' })
  @MaxLength(500)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'screenshot must be a URL' })
  @MaxLength(500)
  screenshot?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsEnum(['new', 'update'] as const)
  type?: 'new' | 'update';

  /** 管理端可直接创建为已通过 */
  @IsOptional()
  @IsEnum(['pending', 'approved'] as const)
  status?: 'pending' | 'approved';
}

export class UpdateFriendApplicationDto {
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'] as const)
  status?: 'pending' | 'approved' | 'rejected';

  @ValidateIf((o: UpdateFriendApplicationDto) => o.status === 'rejected')
  @IsOptional()
  @IsString()
  @MaxLength(300)
  rejectReason?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v != null)
  @IsUrl({ require_protocol: true }, { message: 'avatar must be a URL' })
  @MaxLength(500)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v != null)
  @IsUrl({ require_protocol: true }, { message: 'screenshot must be a URL' })
  @MaxLength(500)
  screenshot?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v != null)
  @IsEmail()
  @MaxLength(120)
  email?: string;
}
