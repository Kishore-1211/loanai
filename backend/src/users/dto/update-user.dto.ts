import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsBoolean,
} from "class-validator";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
