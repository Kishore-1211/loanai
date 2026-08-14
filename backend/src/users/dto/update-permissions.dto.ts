import { IsArray, IsEnum } from "class-validator";
import { Permission } from "@prisma/client";

export class UpdatePermissionsDto {
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];
}
