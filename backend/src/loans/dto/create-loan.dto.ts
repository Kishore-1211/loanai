import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsUUID,
  Max,
  Min,
  ArrayMinSize,
} from "class-validator";
import { InterestType } from "@prisma/client";

export class CreateLoanDto {
  @IsUUID()
  @IsNotEmpty()
  customerId: string;

  @IsArray()
  @IsUUID("4", { each: true })
  @ArrayMinSize(1)
  goldItemIds: string[];

  /**
   * Loan principal in paise. Sent as number over JSON, converted to BigInt in service.
   */
  @IsInt()
  @Min(1)
  principalPaise: number;

  /**
   * Monthly rate in basis points (bps). 100 bps = 1%/month.
   * Range: 1 (0.01%/month) to 10000 (100%/month).
   */
  @IsInt()
  @Min(1)
  @Max(10000)
  monthlyRateBps: number;

  @IsEnum(InterestType)
  interestType: InterestType;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsInt()
  @Min(1)
  @Max(120)
  tenureMonths: number;
}
