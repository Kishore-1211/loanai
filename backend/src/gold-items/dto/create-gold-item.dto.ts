import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { GoldPurity } from "@prisma/client";

export class CreateGoldItemDto {
  @IsUUID()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description: string;

  @IsNumber()
  @Min(0.001)
  @Max(10000)
  weightGrams: number;

  @IsEnum(GoldPurity)
  purity: GoldPurity;

  @IsInt()
  @Min(1)
  estimatedValuePaise: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  conditionNotes?: string;

  @IsOptional()
  @IsUrl()
  photoUrl?: string;
}
