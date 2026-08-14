import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class LoanQueryDto {
  @IsOptional()
  @IsIn(["ACTIVE", "OVERDUE", "SETTLED", "CLOSED"])
  status?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
