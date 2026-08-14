import {
  IsOptional,
  IsString,
  IsInt,
  IsEnum,
  MinLength,
  MaxLength,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { InterestType } from "@prisma/client";

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  businessPhone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  defaultMonthlyRateBps?: number;

  @IsOptional()
  @IsEnum(InterestType)
  defaultInterestType?: InterestType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(360)
  defaultTenureMonths?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  currencySymbol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptFooterText?: string;
}
