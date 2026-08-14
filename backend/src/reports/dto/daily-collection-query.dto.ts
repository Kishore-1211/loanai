import { IsDateString, IsOptional } from "class-validator";

export class DailyCollectionQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
