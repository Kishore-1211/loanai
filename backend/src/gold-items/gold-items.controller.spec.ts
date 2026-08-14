import { Test, TestingModule } from "@nestjs/testing";
import { NotImplementedException } from "@nestjs/common";
import { Role, GoldPurity, GoldItemStatus } from "@prisma/client";
import { GoldItemsController } from "./gold-items.controller";
import { GoldItemsService } from "./gold-items.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { CreateGoldItemDto } from "./dto/create-gold-item.dto";
import { UpdateGoldItemDto } from "./dto/update-gold-item.dto";

// ----------------------------------------------------------------
// Mock helpers
// ----------------------------------------------------------------

const makeOwner = (): JwtPayload => ({
  sub: "owner-id",
  email: "owner@example.com",
  role: Role.OWNER,
  permissions: [],
});

const makeGoldItem = (overrides: Partial<any> = {}) => ({
  id: "item-1",
  customerId: "cust-1",
  loanId: null,
  description: "Gold necklace 22K",
  weightGrams: "10.500",
  purity: GoldPurity.K22,
  estimatedValuePaise: "6000000",
  conditionNotes: null,
  photoUrl: null,
  status: GoldItemStatus.PLEDGED,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// ----------------------------------------------------------------
// Mock service
// ----------------------------------------------------------------

const mockGoldItemsService = {
  create: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe("GoldItemsController", () => {
  let controller: GoldItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoldItemsController],
      providers: [
        { provide: GoldItemsService, useValue: mockGoldItemsService },
      ],
    }).compile();

    controller = module.get<GoldItemsController>(GoldItemsController);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create()", () => {
    it("should delegate to goldItemsService.create with currentUser and dto", async () => {
      const user = makeOwner();
      const dto: CreateGoldItemDto = {
        customerId: "cust-1",
        description: "Gold necklace 22K",
        weightGrams: 10.5,
        purity: GoldPurity.K22,
        estimatedValuePaise: 6000000,
      };
      const expectedResult = makeGoldItem();

      mockGoldItemsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(user, dto);

      expect(mockGoldItemsService.create).toHaveBeenCalledWith(user, dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe("findOne()", () => {
    it("should delegate to goldItemsService.findOne with id", async () => {
      const item = {
        ...makeGoldItem(),
        customer: {
          id: "cust-1",
          fullName: "Ramesh Kumar",
          mobileNumber: "9876543210",
        },
        loan: null,
      };

      mockGoldItemsService.findOne.mockResolvedValue(item);

      const result = await controller.findOne("item-1");

      expect(mockGoldItemsService.findOne).toHaveBeenCalledWith("item-1");
      expect(result).toEqual(item);
    });
  });

  describe("update()", () => {
    it("should delegate to goldItemsService.update with currentUser, id, dto", async () => {
      const user = makeOwner();
      const dto: UpdateGoldItemDto = { description: "Updated gold necklace" };
      const updatedItem = makeGoldItem({
        description: "Updated gold necklace",
      });

      mockGoldItemsService.update.mockResolvedValue(updatedItem);

      const result = await controller.update(user, "item-1", dto);

      expect(mockGoldItemsService.update).toHaveBeenCalledWith(
        user,
        "item-1",
        dto,
      );
      expect(result).toEqual(updatedItem);
    });
  });

  describe("uploadPhoto()", () => {
    it("should throw NotImplementedException (501)", () => {
      expect(() => controller.uploadPhoto("item-1")).toThrow(
        NotImplementedException,
      );
    });
  });
});
