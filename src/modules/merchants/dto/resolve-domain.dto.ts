import { IsFQDN } from 'class-validator';

export class ResolveDomainDto {
  @IsFQDN()
  domain!: string;
}
