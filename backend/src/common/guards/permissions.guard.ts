import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Permission, Role } from "@prisma/client";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { OWNER_ONLY_KEY } from "../decorators/owner-only.decorator";
import { ANY_PERMISSION_KEY } from "../decorators/require-any-permission.decorator";
import { JwtPayload } from "../types/jwt-payload.type";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    const ownerOnly = this.reflector.getAllAndOverride<boolean>(
      OWNER_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const anyPermissions = this.reflector.getAllAndOverride<Permission[]>(
      ANY_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no restrictions set, allow access
    if (
      !ownerOnly &&
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!anyPermissions || anyPermissions.length === 0)
    ) {
      return true;
    }

    if (!user) {
      return false;
    }

    // Check ownerOnly before permissions
    if (ownerOnly && user.role !== Role.OWNER) {
      throw new ForbiddenException("This action requires Owner role");
    }

    // OWNER role bypasses all permission checks
    if (user.role === Role.OWNER) {
      return true;
    }

    // Check if user has ANY of the anyPermissions (OR logic)
    if (anyPermissions && anyPermissions.length > 0) {
      const hasAnyPermission = anyPermissions.some((permission) =>
        user.permissions?.includes(permission),
      );

      if (!hasAnyPermission) {
        throw new ForbiddenException(
          "Insufficient permissions to perform this action",
        );
      }
    }

    // Check if the user has ALL required permissions (AND logic)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAllPermissions = requiredPermissions.every((permission) =>
        user.permissions?.includes(permission),
      );

      if (!hasAllPermissions) {
        throw new ForbiddenException(
          "Insufficient permissions to perform this action",
        );
      }
    }

    return true;
  }
}
