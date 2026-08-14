import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Role, Permission } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdatePermissionsDto } from "./dto/update-permissions.dto";
import { UserQueryDto } from "./dto/user-query.dto";

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const makeOwner = (): JwtPayload => ({
  sub: "owner-id",
  email: "owner@example.com",
  role: Role.OWNER,
  permissions: [],
});

const makeUser = (overrides: Partial<any> = {}) => ({
  id: "user-1",
  email: "staff@example.com",
  passwordHash: "$2b$12$hashedpassword",
  fullName: "Test Staff",
  role: Role.STAFF,
  permissions: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeUserWithoutHash = (overrides: Partial<any> = {}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _passwordHash, ...rest } = makeUser(overrides);
  return rest;
};

// ----------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditService = {
  log: jest.fn(),
};

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe("UsersService", () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // findAll()
  // ----------------------------------------------------------------

  describe("findAll()", () => {
    it("should return all users without passwordHash", async () => {
      const users = [
        makeUserWithoutHash(),
        makeUserWithoutHash({ id: "user-2", email: "staff2@example.com" }),
      ];
      mockPrismaService.user.findMany.mockResolvedValue(users);

      const result = await service.findAll({});

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ id: true, email: true }),
          orderBy: { createdAt: "desc" },
        }),
      );
      expect(result).toHaveLength(2);
      expect((result[0] as any).passwordHash).toBeUndefined();
    });

    it("should filter by isActive=false when provided", async () => {
      const query: UserQueryDto = { isActive: false };
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.findAll(query);

      const findManyCall = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(findManyCall.where.isActive).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // findOne()
  // ----------------------------------------------------------------

  describe("findOne()", () => {
    it("should return user by id without passwordHash", async () => {
      const user = makeUserWithoutHash();
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne("user-1");

      expect(result.id).toBe("user-1");
      expect((result as any).passwordHash).toBeUndefined();
    });

    it("should throw NotFoundException for unknown id", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ----------------------------------------------------------------
  // create()
  // ----------------------------------------------------------------

  describe("create()", () => {
    const dto: CreateUserDto = {
      email: "newstaff@example.com",
      password: "SecurePass1",
      fullName: "New Staff",
    };

    it("should create staff user with bcrypt-hashed password and log USER_CREATED audit", async () => {
      const owner = makeOwner();
      const createdUser = makeUser({
        email: dto.email,
        fullName: dto.fullName,
      });

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue(createdUser) },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      const hashSpy = jest
        .spyOn(bcrypt, "hash")
        .mockResolvedValue("$2b$12$hashedvalue" as never);

      const result = await service.create(owner, dto);

      expect(hashSpy).toHaveBeenCalledWith("SecurePass1", 12);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "USER_CREATED",
          performedById: owner.sub,
          affectedModel: "User",
        }),
        expect.anything(),
      );
      expect(result).toBeDefined();
    });

    it("should throw ConflictException for duplicate email", async () => {
      const owner = makeOwner();
      mockPrismaService.user.findUnique.mockResolvedValue(makeUser());

      await expect(service.create(owner, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should always create new user with role STAFF, never OWNER", async () => {
      const owner = makeOwner();
      let capturedData: any;
      const createdUser = makeUser({ email: dto.email });

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          user: {
            create: jest.fn().mockImplementation(({ data }) => {
              capturedData = data;
              return Promise.resolve(createdUser);
            }),
          },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      jest.spyOn(bcrypt, "hash").mockResolvedValue("hashed" as never);

      await service.create(owner, dto);

      expect(capturedData.role).toBe(Role.STAFF);
    });

    it("should return user without passwordHash", async () => {
      const owner = makeOwner();
      const createdUser = makeUser({
        email: dto.email,
        passwordHash: "$2b$12$secret",
      });

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue(createdUser) },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      jest.spyOn(bcrypt, "hash").mockResolvedValue("hashed" as never);

      const result = await service.create(owner, dto);

      expect((result as any).passwordHash).toBeUndefined();
    });
  });

  // ----------------------------------------------------------------
  // update()
  // ----------------------------------------------------------------

  describe("update()", () => {
    it("should update fullName without auditing", async () => {
      const owner = makeOwner();
      const existingUser = makeUser();
      const updatedUser = makeUser({ fullName: "Updated Name" });

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          user: { update: jest.fn().mockResolvedValue(updatedUser) },
        };
        return fn(tx);
      });

      const dto: UpdateUserDto = { fullName: "Updated Name" };
      const result = await service.update(owner, "user-1", dto);

      expect(result.fullName).toBe("Updated Name");
      // No audit for name-only change
      expect(mockAuditService.log).not.toHaveBeenCalled();
    });

    it("should deactivate user (isActive=false) and log USER_DEACTIVATED audit", async () => {
      const owner = makeOwner();
      const existingUser = makeUser({ isActive: true });
      const updatedUser = makeUser({ isActive: false });

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          user: { update: jest.fn().mockResolvedValue(updatedUser) },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      const dto: UpdateUserDto = { isActive: false };
      await service.update(owner, "user-1", dto);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "USER_DEACTIVATED",
          performedById: owner.sub,
          affectedModel: "User",
          affectedId: "user-1",
          afterValue: { isActive: false },
        }),
        expect.anything(),
      );
    });

    it("should throw NotFoundException for unknown user", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update(makeOwner(), "non-existent", {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------------
  // updatePermissions()
  // ----------------------------------------------------------------

  describe("updatePermissions()", () => {
    it("should update permissions and log USER_PERMISSION_CHANGED with before/after", async () => {
      const owner = makeOwner();
      const existingUser = makeUser({
        permissions: [Permission.CREATE_CUSTOMER],
      });
      const updatedUser = makeUser({
        permissions: [Permission.CREATE_CUSTOMER, Permission.VIEW_ALL_LOANS],
      });

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          user: { update: jest.fn().mockResolvedValue(updatedUser) },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      const dto: UpdatePermissionsDto = {
        permissions: [Permission.CREATE_CUSTOMER, Permission.VIEW_ALL_LOANS],
      };

      const result = await service.updatePermissions(owner, "user-1", dto);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "USER_PERMISSION_CHANGED",
          performedById: owner.sub,
          affectedModel: "User",
          affectedId: "user-1",
          beforeValue: { permissions: [Permission.CREATE_CUSTOMER] },
          afterValue: {
            permissions: [
              Permission.CREATE_CUSTOMER,
              Permission.VIEW_ALL_LOANS,
            ],
          },
        }),
        expect.anything(),
      );
      expect(result.id).toBe("user-1");
      expect(result.permissions).toEqual([
        Permission.CREATE_CUSTOMER,
        Permission.VIEW_ALL_LOANS,
      ]);
    });

    it("should throw ForbiddenException when user modifies own permissions", async () => {
      const owner = makeOwner();

      await expect(
        service.updatePermissions(owner, owner.sub, { permissions: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException for unknown user", async () => {
      const owner = makeOwner();
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePermissions(owner, "non-existent", { permissions: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
