import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsString,
  IsInt,
  IsDateString,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { AuditEventType } from "@prisma/client";

export class AuditLogQueryDto {
  @IsOptional()
  @IsEnum(AuditEventType)
  eventType?: AuditEventType;

  @IsOptional()
  @IsUUID()
  performedById?: string;

  @IsOptional()
  @IsUUID()
  affectedId?: string;

  @IsOptional()
  @IsString()
  affectedModel?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
