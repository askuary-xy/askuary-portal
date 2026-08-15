import { IsArray } from 'class-validator';

export class PutPortalConfigDto {
  @IsArray()
  items!: unknown[];
}
