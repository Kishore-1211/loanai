import { Test, TestingModule } from "@nestjs/testing";
import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Role, GoldPurity, GoldItemStatus } from "@prisma/client";
import { GoldItemsService } from "./gold-items.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
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

const makeCustomer = (overrides: Partial<any> = {}) => ({
  id: "cust-1",
  fullName: "Ramesh Kumar",
  mobileNumber: "9876543210",
  isActive: true,
  ...overrides,
});

const makeGoldItem = (overrides: Partial<any> = {}) => ({
  id: "item-1",
  customerId: "cust-1",
  loanId: null,
  description: "Gold necklace 22K",
  weightGrams: "10.500",
  purity: GoldPurity.K22,
  estimatedValuePaise: BigInt(6000000),
  conditionNotes: null,
  photoUrl: null,
  status: GoldItemStatus.PLEDGED,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ----------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------

const mockPrismaService = {
  customer: {
    findUnique: jest.fn(),
  },
  goldItem: {
    findUnique: jest.fn(),
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

describe("GoldItemsService", () => {
  let service: GoldItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoldItemsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<GoldItemsService>(GoldItemsService);
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // create()
  // ----------------------------------------------------------------

  describe("create()", () => {
    const dto: CreateGoldItemDto = {
      customerId: "cust-1",
      description: "Gold necklace 22K",
      weightGrams: 10.5,
      purity: GoldPurity.K22,
      estimatedValuePaise: 6000000,
      conditionNotes: "Good condition",
    };

    it("should create a gold item, link to customer, and log GOLD_ITEM_CREATED audit", async () => {
      const user = makeOwner();
      const customer = makeCustomer();
      const createdItem = makeGoldItem({ conditionNotes: "Good condition" });

      mockPrismaService.customer.findUnique.mockResolvedValue(customer);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          goldItem: { create: jest.fn().mockResolvedValue(createdItem) },
          auditLog: { create: jest.fn() },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      const result = await service.create(user, dto);

      expect(result.description).toBe("Gold necklace 22K");
      expect(result.customerId).toBe("cust-1");
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "GOLD_ITEM_CREATED",
          performedById: user.sub,
          affectedModel: "GoldItem",
          afterValue: expect.objectContaining({
            description: dto.description,
            purity: dto.purity,
            customerId: dto.customerId,
          }),
        }),
        expect.anything(),
      );
    });

    it("should convert estimatedValuePaise number to BigInt correctly", async () => {
      const user = makeOwner();
      const customer = makeCustomer();
      const createdItem = makeGoldItem({
        estimatedValuePaise: BigInt(dto.estimatedValuePaise),
      });

      mockPrismaService.customer.findUnique.mockResolvedValue(customer);

      let capturedData: any;
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          goldItem: {
            create: jest.fn().mockImplementation((args) => {
              capturedData = args.data;
              return Promise.resolve(createdItem);
            }),
          },
          auditLog: { create: jest.fn() },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      await service.create(user, dto);

      expect(capturedData.estimatedValuePaise).toBe(BigInt(6000000));
      expect(typeof capturedData.estimatedValuePaise).toBe("bigint");
    });

    it("should throw NotFoundException if customer not found", async () => {
      const user = makeOwner();
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.create(user, dto)).rejects.toThrow(
        new NotFoundException("Customer not found"),
      );
    });

    it("should throw UnprocessableEntityException if customer is inactive", async () => {
      const user = makeOwner();
      const inactiveCustomer = makeCustomer({ isActive: false });
      mockPrismaService.customer.findUnique.mockResolvedValue(inactiveCustomer);

      await expect(service.create(user, dto)).rejects.toThrow(
        new UnprocessableEntityException("Customer account is inactive"),
      );
    });
  });

  // ----------------------------------------------------------------
  // findOne()
  // ----------------------------------------------------------------

  describe("findOne()", () => {
    it("should return gold item with customer and loan references", async () => {
      const item = makeGoldItem();
      const itemWithRelations = {
        ...item,
        customer: {
          id: "cust-1",
          fullName: "Ramesh Kumar",
          mobileNumber: "9876543210",
        },
        loan: null,
      };

      mockPrismaService.goldItem.findUnique.mockResolvedValue(
        itemWithRelations,
      );

      const result = await service.findOne("item-1");

      expect(result.id).toBe("item-1");
      expect(result.customer.fullName).toBe("Ramesh Kumar");
      expect(result.loan).toBeNull();
      expect(mockPrismaService.goldItem.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "item-1" } }),
      );
    });

    it("should throw NotFoundException if not found", async () => {
      mockPrismaService.goldItem.findUnique.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        new NotFoundException("Gold item not found"),
      );
    });

    it("should serialize BigInt fields to string in response", async () => {
      const item = makeGoldItem({ estimatedValuePaise: BigInt(6000000) });
      const itemWithRelations = {
        ...item,
        customer: {
          id: "cust-1",
          fullName: "Ramesh Kumar",
          mobileNumber: "9876543210",
        },
        loan: null,
      };

      mockPrismaService.goldItem.findUnique.mockResolvedValue(
        itemWithRelations,
      );

      const result = await service.findOne("item-1");

      expect(typeof result.estimatedValuePaise).toBe("string");
      expect(result.estimatedValuePaise).toBe("6000000");
    });
  });

  // ----------------------------------------------------------------
  // update()
  // ----------------------------------------------------------------

  describe("update()", () => {
    const dto: UpdateGoldItemDto = {
      description: "Updated gold necklace",
      conditionNotes: "Minor scratches",
    };

    it("should update description and log GOLD_ITEM_UPDATED with before/after values", async () => {
      const user = makeOwner();
      const existingItem = makeGoldItem({ conditionNotes: "Good condition" });
      const updatedItem = makeGoldItem({
        description: "Updated gold necklace",
        conditionNotes: "Minor scratches",
      });

      mockPrismaService.goldItem.findUnique.mockResolvedValue(existingItem);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          goldItem: { update: jest.fn().mockResolvedValue(updatedItem) },
          auditLog: { create: jest.fn() },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      const result = await service.update(user, "item-1", dto);

      expect(result.description).toBe("Updated gold necklace");
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "GOLD_ITEM_UPDATED",
          performedById: user.sub,
          affectedModel: "GoldItem",
          affectedId: "item-1",
          beforeValue: expect.objectContaining({
            description: "Gold necklace 22K",
            conditionNotes: "Good condition",
          }),
          afterValue: expect.objectContaining({
            description: "Updated gold necklace",
            conditionNotes: "Minor scratches",
          }),
        }),
        expect.anything(),
      );
    });

    it("should do a partial update when only some fields are provided", async () => {
      const user = makeOwner();
      const existingItem = makeGoldItem({ conditionNotes: "Good condition" });
      const updatedItem = makeGoldItem({ conditionNotes: "Worn edges" });

      mockPrismaService.goldItem.findUnique.mockResolvedValue(existingItem);

      let capturedUpdateData: any;
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          goldItem: {
            update: jest.fn().mockImplementation((args) => {
              capturedUpdateData = args.data;
              return Promise.resolve(updatedItem);
            }),
          },
          auditLog: { create: jest.fn() },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      // Only update conditionNotes, not description
      await service.update(user, "item-1", { conditionNotes: "Worn edges" });

      // description should NOT be in the update data
      expect(capturedUpdateData.description).toBeUndefined();
      expect(capturedUpdateData.conditionNotes).toBe("Worn edges");
    });

    it("should throw NotFoundException if gold item not found", async () => {
      const user = makeOwner();
      mockPrismaService.goldItem.findUnique.mockResolvedValue(null);

      await expect(service.update(user, "non-existent", dto)).rejects.toThrow(
        new NotFoundException("Gold item not found"),
      );
    });
  });
});
