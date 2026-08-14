import { IsDateString } from "class-validator";

export class InterestIncomeQueryDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;
}
