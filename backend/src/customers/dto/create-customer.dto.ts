import {
  IsString,
  IsEnum,
  IsOptional,
  IsUrl,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { IdProofType } from '@prisma/client';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'mobileNumber must be a valid 10-digit Indian mobile number starting with 6-9',
  })
  mobileNumber: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address: string;

  @IsEnum(IdProofType)
  idProofType: IdProofType;

  @IsString()
  @MinLength(4)
  @MaxLength(50)
  idProofNumber: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @IsOptional()
  @IsUrl()
  idDocumentUrl?: string;
}
