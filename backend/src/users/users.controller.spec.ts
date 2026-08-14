import { Test, TestingModule } from "@nestjs/testing";
import { Role, Permission } from "@prisma/client";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
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
  fullName: "Test Staff",
  role: Role.STAFF,
  permissions: [],
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// ----------------------------------------------------------------
// Mock service
// ----------------------------------------------------------------

const mockUsersService = {
  findAll: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  updatePermissions: jest.fn(),
};

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe("UsersController", () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll()", () => {
    it("should delegate to usersService.findAll", async () => {
      const query: UserQueryDto = { isActive: true };
      const users = [makeUser()];
      mockUsersService.findAll.mockResolvedValue(users);

      const result = await controller.findAll(query);

      expect(mockUsersService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(users);
    });
  });

  describe("create()", () => {
    it("should delegate to usersService.create with currentUser", async () => {
      const user = makeOwner();
      const dto: CreateUserDto = {
        email: "new@example.com",
        password: "SecurePass1",
        fullName: "New Staff",
      };
      const created = makeUser({ email: dto.email });
      mockUsersService.create.mockResolvedValue(created);

      const result = await controller.create(user, dto);

      expect(mockUsersService.create).toHaveBeenCalledWith(user, dto);
      expect(result).toEqual(created);
    });
  });

  describe("findOne()", () => {
    it("should delegate to usersService.findOne", async () => {
      const user = makeUser();
      mockUsersService.findOne.mockResolvedValue(user);

      const result = await controller.findOne("user-1");

      expect(mockUsersService.findOne).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(user);
    });
  });

  describe("update()", () => {
    it("should delegate to usersService.update with currentUser", async () => {
      const owner = makeOwner();
      const dto: UpdateUserDto = { fullName: "Updated Name" };
      const updated = makeUser({ fullName: "Updated Name" });
      mockUsersService.update.mockResolvedValue(updated);

      const result = await controller.update(owner, "user-1", dto);

      expect(mockUsersService.update).toHaveBeenCalledWith(
        owner,
        "user-1",
        dto,
      );
      expect(result).toEqual(updated);
    });
  });

  describe("updatePermissions()", () => {
    it("should delegate to usersService.updatePermissions with currentUser", async () => {
      const owner = makeOwner();
      const dto: UpdatePermissionsDto = {
        permissions: [Permission.CREATE_CUSTOMER],
      };
      const response = {
        id: "user-1",
        permissions: [Permission.CREATE_CUSTOMER],
      };
      mockUsersService.updatePermissions.mockResolvedValue(response);

      const result = await controller.updatePermissions(owner, "user-1", dto);

      expect(mockUsersService.updatePermissions).toHaveBeenCalledWith(
        owner,
        "user-1",
        dto,
      );
      expect(result).toEqual(response);
    });
  });
});
