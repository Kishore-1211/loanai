import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class MonthlyCollectionQueryDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  @Type(() => Number)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;
}
