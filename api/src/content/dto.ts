import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateContentDto {
  @IsIn(['journal', 'blog'])
  kind!: 'journal' | 'blog';

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  cover?: string;

  @IsString()
  @MinLength(1)
  markdown!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  date?: string;

  /** 写作入口：shuoshuo 时强制 tags 含「碎念」 */
  @IsOptional()
  @IsIn(['article', 'shuoshuo', 'blog'])
  mode?: 'article' | 'shuoshuo' | 'blog';
}

export class ImportContentItemDto {
  @IsIn(['journal', 'blog'])
  kind!: 'journal' | 'blog';

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  cover?: string;

  @IsOptional()
  @IsString()
  markdown?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  date?: string;

  @IsOptional()
  @IsIn(['article', 'shuoshuo', 'blog'])
  mode?: 'article' | 'shuoshuo' | 'blog';
}

export class ImportContentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportContentItemDto)
  items!: ImportContentItemDto[];

  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}

export class UpdateContentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  cover?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  markdown?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  date?: string;

  @IsOptional()
  @IsIn(['article', 'shuoshuo', 'blog'])
  mode?: 'article' | 'shuoshuo' | 'blog';
}

/** 后台 Markdown 预览（含短代码） */
export class PreviewMarkdownDto {
  @IsString()
  markdown!: string;
}
