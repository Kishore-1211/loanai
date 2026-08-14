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

/**
 * UpdateCustomerDto — all fields from CreateCustomerDto are optional.
 * Uses explicit optional fields instead of PartialType to avoid issues
 * with @nestjs/mapped-types in some setups.
 */
export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'mobileNumber must be a valid 10-digit Indian mobile number starting with 6-9',
  })
  mobileNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsEnum(IdProofType)
  idProofType?: IdProofType;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(50)
  idProofNumber?: string;

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
