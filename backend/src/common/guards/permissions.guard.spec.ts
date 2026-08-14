import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role, Permission } from "@prisma/client";
import { PermissionsGuard } from "./permissions.guard";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { OWNER_ONLY_KEY } from "../decorators/owner-only.decorator";
import { ANY_PERMISSION_KEY } from "../decorators/require-any-permission.decorator";
import { JwtPayload } from "../types/jwt-payload.type";

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const makeOwnerPayload = (): JwtPayload => ({
  sub: "owner-id",
  email: "owner@example.com",
  role: Role.OWNER,
  permissions: [],
});

const makeStaffPayload = (permissions: Permission[] = []): JwtPayload => ({
  sub: "staff-id",
  email: "staff@example.com",
  role: Role.STAFF,
  permissions,
});

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe("PermissionsGuard", () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it("should allow access when no ownerOnly and no permissions required", () => {
    jest
      .spyOn(reflector, "getAllAndOverride")
      .mockImplementation((key: any) => {
        if (key === OWNER_ONLY_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        return undefined;
      });

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: makeOwnerPayload() }),
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should allow OWNER when ownerOnly=true", () => {
    jest
      .spyOn(reflector, "getAllAndOverride")
      .mockImplementation((key: any) => {
        if (key === OWNER_ONLY_KEY) return true;
        if (key === PERMISSIONS_KEY) return undefined;
        return undefined;
      });

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: makeOwnerPayload() }),
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should throw ForbiddenException when ownerOnly=true and user is STAFF", () => {
    jest
      .spyOn(reflector, "getAllAndOverride")
      .mockImplementation((key: any) => {
        if (key === OWNER_ONLY_KEY) return true;
        if (key === PERMISSIONS_KEY) return undefined;
        return undefined;
      });

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: makeStaffPayload() }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException("This action requires Owner role"),
    );
  });

  it("should allow STAFF with correct required permissions", () => {
    jest
      .spyOn(reflector, "getAllAndOverride")
      .mockImplementation((key: any) => {
        if (key === OWNER_ONLY_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return [Permission.CREATE_CUSTOMER];
        return undefined;
      });

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: makeStaffPayload([Permission.CREATE_CUSTOMER]),
        }),
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should throw ForbiddenException when STAFF lacks required permission", () => {
    jest
      .spyOn(reflector, "getAllAndOverride")
      .mockImplementation((key: any) => {
        if (key === OWNER_ONLY_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return [Permission.VIEW_REPORTS];
        return undefined;
      });

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: makeStaffPayload([Permission.CREATE_CUSTOMER]),
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException("Insufficient permissions to perform this action"),
    );
  });

  it("should allow OWNER regardless of required permissions (owner bypasses all)", () => {
    jest
      .spyOn(reflector, "getAllAndOverride")
      .mockImplementation((key: any) => {
        if (key === OWNER_ONLY_KEY) return undefined;
        if (key === PERMISSIONS_KEY)
          return [Permission.VIEW_REPORTS, Permission.MANAGE_STAFF];
        if (key === ANY_PERMISSION_KEY) return undefined;
        return undefined;
      });

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: makeOwnerPayload() }),
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should allow access when user has ANY of the anyPermissions", () => {
    jest
      .spyOn(reflector, "getAllAndOverride")
      .mockImplementation((key: any) => {
        if (key === OWNER_ONLY_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === ANY_PERMISSION_KEY)
          return [Permission.CREATE_CUSTOMER, Permission.CREATE_LOAN];
        return undefined;
      });

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          // Staff has CREATE_CUSTOMER but NOT CREATE_LOAN — should still pass (OR logic)
          user: makeStaffPayload([Permission.CREATE_CUSTOMER]),
        }),
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should throw ForbiddenException when user has NONE of the anyPermissions", () => {
    jest
      .spyOn(reflector, "getAllAndOverride")
      .mockImplementation((key: any) => {
        if (key === OWNER_ONLY_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === ANY_PERMISSION_KEY)
          return [Permission.CREATE_CUSTOMER, Permission.CREATE_LOAN];
        return undefined;
      });

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          // Staff has VIEW_REPORTS — none of the anyPermissions
          user: makeStaffPayload([Permission.VIEW_REPORTS]),
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException("Insufficient permissions to perform this action"),
    );
  });

  it("should allow OWNER to bypass anyPermissions check", () => {
    jest
      .spyOn(reflector, "getAllAndOverride")
      .mockImplementation((key: any) => {
        if (key === OWNER_ONLY_KEY) return undefined;
        if (key === PERMISSIONS_KEY) return undefined;
        if (key === ANY_PERMISSION_KEY)
          return [Permission.CREATE_CUSTOMER, Permission.CREATE_LOAN];
        return undefined;
      });

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          // OWNER has no explicit permissions but bypasses all checks
          user: makeOwnerPayload(),
        }),
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });
});
