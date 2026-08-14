import { Test, TestingModule } from "@nestjs/testing";
import { InterestType, Role } from "@prisma/client";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
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
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// ----------------------------------------------------------------
// Mock service
// ----------------------------------------------------------------

const mockSettingsService = {
  getSettings: jest.fn(),
  updateSettings: jest.fn(),
};

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe("SettingsController", () => {
  let controller: SettingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [{ provide: SettingsService, useValue: mockSettingsService }],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);

    jest.clearAllMocks();
  });

  it("SettingsController should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("getSettings() delegates to settingsService.getSettings()", async () => {
    const settings = makeSettings();
    mockSettingsService.getSettings.mockResolvedValue(settings);

    const result = await controller.getSettings();

    expect(result).toEqual(settings);
    expect(mockSettingsService.getSettings).toHaveBeenCalledTimes(1);
  });

  it("updateSettings() delegates to settingsService.updateSettings() with currentUser and dto", async () => {
    const owner = makeOwner();
    const dto: UpdateSettingsDto = { businessName: "Updated Gold Palace" };
    const updated = makeSettings({ businessName: "Updated Gold Palace" });

    mockSettingsService.updateSettings.mockResolvedValue(updated);

    const result = await controller.updateSettings(owner, dto);

    expect(result).toEqual(updated);
    expect(mockSettingsService.updateSettings).toHaveBeenCalledWith(owner, dto);
  });
});
