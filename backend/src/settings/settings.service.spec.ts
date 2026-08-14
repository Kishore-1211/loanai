import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { AuditEventType, InterestType, Role } from "@prisma/client";
import { SettingsService } from "./settings.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

// ----------------------------------------------------------------
// Mock helpers
// ----------------------------------------------------------------

const makeOwner = (): JwtPayload => ({
  sub: "owner-id",
  email: "owner@example.com",
  role: Role.OWNER,
  permissions: [],
});

const makeSettings = (overrides: Partial<any> = {}) => ({
  id: "singleton",
  businessName: "Gold Palace",
  businessAddress: "123 Main Street, Chennai",
  businessPhone: "9876543210",
  defaultMonthlyRateBps: 150,
  defaultInterestType: InterestType.FLAT_MONTHLY,
  defaultTenureMonths: 6,
  currencySymbol: "Rs.",
  receiptFooterText: "Thank you for your business",
  updatedAt: new Date(),
  ...overrides,
});

// ----------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------

const mockPrismaService = {
  businessSettings: {
    findUnique: jest.fn(),
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

describe("SettingsService", () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);

    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // getSettings
  // ----------------------------------------------------------------

  describe("getSettings()", () => {
    it("should return the singleton settings object", async () => {
      const settings = makeSettings();
      mockPrismaService.businessSettings.findUnique.mockResolvedValue(settings);

      const result = await service.getSettings();

      expect(result).toEqual(settings);
      expect(
        mockPrismaService.businessSettings.findUnique,
      ).toHaveBeenCalledWith({
        where: { id: "singleton" },
      });
    });

    it("should throw NotFoundException when settings row is null", async () => {
      mockPrismaService.businessSettings.findUnique.mockResolvedValue(null);

      await expect(service.getSettings()).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------------
  // updateSettings
  // ----------------------------------------------------------------

  describe("updateSettings()", () => {
    it("should update only the provided fields (partial update) and return updated settings", async () => {
      const owner = makeOwner();
      const existing = makeSettings();
      const dto: UpdateSettingsDto = { businessName: "New Gold Palace" };
      const updated = makeSettings({ businessName: "New Gold Palace" });

      mockPrismaService.businessSettings.findUnique.mockResolvedValue(existing);

      // Mock $transaction to execute the callback with a mock tx
      const mockTx = {
        businessSettings: { update: jest.fn().mockResolvedValue(updated) },
      };
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.updateSettings(owner, dto);

      expect(result).toEqual(updated);
      expect(mockTx.businessSettings.update).toHaveBeenCalledWith({
        where: { id: "singleton" },
        data: dto,
      });
    });

    it("should log SETTINGS_CHANGED audit event with correct beforeValue and afterValue inside transaction", async () => {
      const owner = makeOwner();
      const existing = makeSettings();
      const dto: UpdateSettingsDto = { currencySymbol: "₹" };
      const updated = makeSettings({ currencySymbol: "₹" });

      mockPrismaService.businessSettings.findUnique.mockResolvedValue(existing);

      const mockTx = {
        businessSettings: { update: jest.fn().mockResolvedValue(updated) },
      };
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: any) => Promise<any>) => cb(mockTx),
      );
      mockAuditService.log.mockResolvedValue(undefined);

      await service.updateSettings(owner, dto);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        {
          eventType: AuditEventType.SETTINGS_CHANGED,
          performedById: owner.sub,
          performedByName: owner.email,
          affectedModel: "BusinessSettings",
          affectedId: "singleton",
          beforeValue: {
            businessName: existing.businessName,
            businessAddress: existing.businessAddress,
            businessPhone: existing.businessPhone,
            defaultMonthlyRateBps: existing.defaultMonthlyRateBps,
            defaultInterestType: existing.defaultInterestType,
            defaultTenureMonths: existing.defaultTenureMonths,
            currencySymbol: existing.currencySymbol,
            receiptFooterText: existing.receiptFooterText,
          },
          afterValue: dto,
        },
        mockTx,
      );
    });

    it("should throw NotFoundException when settings row not found before update", async () => {
      const owner = makeOwner();
      const dto: UpdateSettingsDto = { businessName: "Ghost Business" };

      mockPrismaService.businessSettings.findUnique.mockResolvedValue(null);

      await expect(service.updateSettings(owner, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
