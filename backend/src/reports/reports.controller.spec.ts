import { Test, TestingModule } from "@nestjs/testing";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { DailyCollectionQueryDto } from "./dto/daily-collection-query.dto";
import { MonthlyCollectionQueryDto } from "./dto/monthly-collection-query.dto";

// ---------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------

const mockReportsService = {
  getDailyCollection: jest.fn(),
  getMonthlyCollection: jest.fn(),
  getOutstanding: jest.fn(),
  getOverdue: jest.fn(),
  getInterestIncome: jest.fn(),
  getLoanSummary: jest.fn(),
  getCustomerLedger: jest.fn(),
};

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("ReportsController", () => {
  let controller: ReportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: mockReportsService }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    jest.clearAllMocks();
  });

  it("test 1: ReportsController is defined", () => {
    expect(controller).toBeDefined();
  });

  it("test 2: getDailyCollection delegates to reportsService.getDailyCollection", async () => {
    const expected = {
      date: "2026-03-01",
      totalCollectedPaise: "9000",
      paymentCount: 2,
    };
    mockReportsService.getDailyCollection.mockResolvedValue(expected);

    const query: DailyCollectionQueryDto = { date: "2026-03-01" };
    const result = await controller.getDailyCollection(query);

    expect(mockReportsService.getDailyCollection).toHaveBeenCalledWith(
      "2026-03-01",
    );
    expect(result).toEqual(expected);
  });

  it("test 3: getMonthlyCollection delegates to reportsService.getMonthlyCollection with year and month", async () => {
    const expected = {
      year: 2026,
      month: 3,
      totalCollectedPaise: "45000",
      paymentCount: 10,
    };
    mockReportsService.getMonthlyCollection.mockResolvedValue(expected);

    const query: MonthlyCollectionQueryDto = { year: 2026, month: 3 };
    const result = await controller.getMonthlyCollection(query);

    expect(mockReportsService.getMonthlyCollection).toHaveBeenCalledWith(
      2026,
      3,
    );
    expect(result).toEqual(expected);
  });

  it("test 4: getCustomerLedger delegates to reportsService.getCustomerLedger with customerId", async () => {
    const expected = {
      customer: { id: "cust-uuid", fullName: "Ravi Kumar" },
      loans: [],
    };
    mockReportsService.getCustomerLedger.mockResolvedValue(expected);

    const result = await controller.getCustomerLedger("cust-uuid");

    expect(mockReportsService.getCustomerLedger).toHaveBeenCalledWith(
      "cust-uuid",
    );
    expect(result).toEqual(expected);
  });
});
