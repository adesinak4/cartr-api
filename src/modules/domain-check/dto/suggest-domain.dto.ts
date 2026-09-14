import { IsString, MaxLength, MinLength } from 'class-validator';

export class SuggestDomainDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  businessName!: string;
}
