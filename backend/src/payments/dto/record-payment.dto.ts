import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class RecordPaymentDto {
  @IsUUID()
  @IsNotEmpty()
  loanId: string;

  @IsDateString()
  @IsNotEmpty()
  paymentDate: string;

  @IsInt()
  @Min(1)
  totalAmountPaise: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
