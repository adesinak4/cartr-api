import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertPlatformSettingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  value!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
