import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveDisputeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  resolutionNotes!: string;
}
