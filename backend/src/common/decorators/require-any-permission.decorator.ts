import { SetMetadata } from "@nestjs/common";
import { Permission } from "@prisma/client";

export const ANY_PERMISSION_KEY = "anyPermission";

export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(ANY_PERMISSION_KEY, permissions);
