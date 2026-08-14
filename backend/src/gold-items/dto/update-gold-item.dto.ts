import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateGoldItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  conditionNotes?: string;
}
