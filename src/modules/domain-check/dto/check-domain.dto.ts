import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CheckDomainDto {
  /** The second-level label only, e.g. "zaracollections" — never the full domain with TLD. */
  @IsString()
  @MinLength(1)
  @MaxLength(63)
  @Matches(/^[a-z0-9-]+$/i, {
    message: 'domain must contain only letters, numbers, and hyphens',
  })
  domain!: string;
}
