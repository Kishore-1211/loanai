import { IsOptional, IsBoolean } from "class-validator";
import { Transform } from "class-transformer";

export class UserQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isActive?: boolean;
}
