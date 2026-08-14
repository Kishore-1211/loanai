import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import {
  InterestType,
  LoanStatus,
  PaymentMethod,
  PaymentType,
} from "@prisma/client";
import { ReportsService } from "./reports.service";
import { PrismaService } from "../prisma/prisma.service";
import { InterestService } from "../loans/interest.service";

// ---------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------

const makeLoan = (overrides: Partial<any> = {}) => ({
  id: "loan-uuid",
  loanNumber: "GL-1001",
  customerId: "cust-uuid",
  createdById: "owner-uuid",
  principalPaise: BigInt(100_000_00), // 1,00,000 rupees
  monthlyRateBps: 200,
  interestType: InterestType.FLAT_MONTHLY,
  startDate: new Date("2026-01-01"),
  dueDate: new Date("2026-04-01"),
  tenureMonths: 3,
  status: LoanStatus.ACTIVE,
  settledAt: null,
  closedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  customer: {
    id: "cust-uuid",
    fullName: "Ravi Kumar",
    mobileNumber: "9876543210",
  },
  payments: [],
  ...overrides,
});

const makePayment = (overrides: Partial<any> = {}) => ({
  id: "payment-uuid",
  loanId: "loan-uuid",
  recordedById: "owner-uuid",
  paymentDate: new Date("2026-03-01"),
  totalAmountPaise: BigInt(6000),
  interestAmountPaise: BigInt(6000),
  principalAmountPaise: BigInt(0),
  paymentMethod: PaymentMethod.CASH,
  paymentType: PaymentType.INTEREST_ONLY,
  referenceNumber: null,
  notes: null,
  createdAt: new Date("2026-03-01"),
  loan: {
    customer: {
      id: "cust-uuid",
      fullName: "Ravi Kumar",
      mobileNumber: "9876543210",
    },
  },
  recordedBy: { id: "owner-uuid", fullName: "Owner" },
  receipt: { id: "receipt-uuid", receiptNumber: "REC-10001" },
  ...overrides,
});

// ---------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------

const mockPrisma = {
  payment: {
    findMany: jest.fn(),
  },
  loan: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  customer: {
    findUnique: jest.fn(),
  },
};

const mockInterestService = {
  calculateAccruedInterest: jest.fn(),
  calculateOutstandingInterest: jest.fn(),
  calculateOutstandingPrincipal: jest.fn(),
};

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("ReportsService", () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InterestService, useValue: mockInterestService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------
  // getDailyCollection
  // ---------------------------------------------------------------

  describe("getDailyCollection()", () => {
    it("test 1: returns correct totals for a given date", async () => {
      const p1 = makePayment({
        totalAmountPaise: BigInt(5000),
        interestAmountPaise: BigInt(3000),
        principalAmountPaise: BigInt(2000),
      });
      const p2 = makePayment({
        id: "payment-uuid-2",
        totalAmountPaise: BigInt(4000),
        interestAmountPaise: BigInt(2000),
        principalAmountPaise: BigInt(2000),
      });
      mockPrisma.payment.findMany.mockResolvedValue([p1, p2]);

      const result = await service.getDailyCollection("2026-03-01");

      expect(result.totalCollectedPaise).toBe("9000");
      expect(result.interestCollectedPaise).toBe("5000");
      expect(result.principalCollectedPaise).toBe("4000");
      expect(result.paymentCount).toBe(2);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledTimes(1);
    });

    it("test 2: defaults to today when date not provided", async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);

      await service.getDailyCollection();

      const call = mockPrisma.payment.findMany.mock.calls[0][0];
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];

      expect(call.where.paymentDate.gte.toISOString().split("T")[0]).toBe(
        todayStr,
      );
    });

    it("test 3: returns empty totals when no payments on date", async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const result = await service.getDailyCollection("2026-03-01");

      expect(result.totalCollectedPaise).toBe("0");
      expect(result.interestCollectedPaise).toBe("0");
      expect(result.principalCollectedPaise).toBe("0");
      expect(result.paymentCount).toBe(0);
      expect(result.payments).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------
  // getMonthlyCollection
  // ---------------------------------------------------------------

  describe("getMonthlyCollection()", () => {
    it("test 4: returns correct monthly totals and dailyBreakdown grouped by date", async () => {
      const day1a = makePayment({
        paymentDate: new Date("2026-03-05"),
        totalAmountPaise: BigInt(3000),
        interestAmountPaise: BigInt(2000),
        principalAmountPaise: BigInt(1000),
      });
      const day1b = makePayment({
        id: "p2",
        paymentDate: new Date("2026-03-05"),
        totalAmountPaise: BigInt(2000),
        interestAmountPaise: BigInt(1000),
        principalAmountPaise: BigInt(1000),
      });
      const day2 = makePayment({
        id: "p3",
        paymentDate: new Date("2026-03-20"),
        totalAmountPaise: BigInt(4000),
        interestAmountPaise: BigInt(4000),
        principalAmountPaise: BigInt(0),
      });
      mockPrisma.payment.findMany.mockResolvedValue([day1a, day1b, day2]);

      const result = await service.getMonthlyCollection(2026, 3);

      expect(result.totalCollectedPaise).toBe("9000");
      expect(result.interestCollectedPaise).toBe("7000");
      expect(result.principalCollectedPaise).toBe("2000");
      expect(result.paymentCount).toBe(3);
      expect(result.dailyBreakdown).toHaveLength(2);
      expect(result.dailyBreakdown[0].date).toBe("2026-03-05");
      expect(result.dailyBreakdown[0].totalPaise).toBe("5000");
      expect(result.dailyBreakdown[0].count).toBe(2);
      expect(result.dailyBreakdown[1].date).toBe("2026-03-20");
    });

    it("test 5: returns empty result when no payments in month", async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const result = await service.getMonthlyCollection(2026, 1);

      expect(result.totalCollectedPaise).toBe("0");
      expect(result.paymentCount).toBe(0);
      expect(result.dailyBreakdown).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------
  // getOutstanding
  // ---------------------------------------------------------------

  describe("getOutstanding()", () => {
    it("test 6: returns total outstanding computed via InterestService for each active loan", async () => {
      const loan = makeLoan({
        payments: [
          {
            interestAmountPaise: BigInt(2000),
            principalAmountPaise: BigInt(0),
          },
        ],
      });
      mockPrisma.loan.findMany.mockResolvedValue([loan]);
      mockInterestService.calculateAccruedInterest.mockReturnValue(
        BigInt(6000),
      );
      mockInterestService.calculateOutstandingInterest.mockReturnValue(
        BigInt(4000),
      );
      mockInterestService.calculateOutstandingPrincipal.mockReturnValue(
        BigInt(100_000_00),
      );

      const result = await service.getOutstanding();

      expect(result.activeLoanCount).toBe(1);
      expect(result.totalInterestOutstandingPaise).toBe("4000");
      expect(result.totalPrincipalOutstandingPaise).toBe("10000000");
      expect(result.totalOutstandingPaise).toBe("10004000");
      expect(result.loans).toHaveLength(1);
      expect(result.loans[0].outstandingInterestPaise).toBe("4000");
    });

    it("test 7: excludes SETTLED and CLOSED loans", async () => {
      mockPrisma.loan.findMany.mockResolvedValue([]);

      const result = await service.getOutstanding();

      const call = mockPrisma.loan.findMany.mock.calls[0][0];
      expect(call.where.status.notIn).toContain(LoanStatus.SETTLED);
      expect(call.where.status.notIn).toContain(LoanStatus.CLOSED);
      expect(result.activeLoanCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // getOverdue
  // ---------------------------------------------------------------

  describe("getOverdue()", () => {
    it("test 8: returns only overdue loans with daysOverdue; excludes SETTLED and CLOSED", async () => {
      const pastDue = new Date();
      pastDue.setDate(pastDue.getDate() - 10);
      const loan = makeLoan({
        dueDate: pastDue,
        payments: [],
      });
      mockPrisma.loan.findMany.mockResolvedValue([loan]);
      mockInterestService.calculateAccruedInterest.mockReturnValue(
        BigInt(6000),
      );
      mockInterestService.calculateOutstandingInterest.mockReturnValue(
        BigInt(6000),
      );
      mockInterestService.calculateOutstandingPrincipal.mockReturnValue(
        BigInt(100_000_00),
      );

      const result = await service.getOverdue();

      const call = mockPrisma.loan.findMany.mock.calls[0][0];
      expect(call.where.status.notIn).toContain(LoanStatus.SETTLED);
      expect(call.where.status.notIn).toContain(LoanStatus.CLOSED);
      expect(result).toHaveLength(1);
      expect(result[0].daysOverdue).toBeGreaterThanOrEqual(10);
      expect(result[0].outstandingInterestPaise).toBe("6000");
    });
  });

  // ---------------------------------------------------------------
  // getInterestIncome
  // ---------------------------------------------------------------

  describe("getInterestIncome()", () => {
    it("test 9: sums interestAmountPaise across all payments in date range (inclusive)", async () => {
      const p1 = makePayment({ interestAmountPaise: BigInt(3000) });
      const p2 = makePayment({ id: "p2", interestAmountPaise: BigInt(5000) });
      mockPrisma.payment.findMany.mockResolvedValue([p1, p2]);

      const result = await service.getInterestIncome(
        "2026-03-01",
        "2026-03-31",
      );

      expect(result.totalInterestCollectedPaise).toBe("8000");
      expect(result.paymentCount).toBe(2);
      expect(result.fromDate).toBe("2026-03-01");
      expect(result.toDate).toBe("2026-03-31");
    });
  });

  // ---------------------------------------------------------------
  // getLoanSummary
  // ---------------------------------------------------------------

  describe("getLoanSummary()", () => {
    it("test 10: returns correct counts and totalCurrentOutstandingPaise", async () => {
      const now = new Date();
      const futureDue = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const pastDue = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      const activeLoan = makeLoan({ dueDate: futureDue, payments: [] });
      const overdueLoan = makeLoan({
        id: "loan-2",
        loanNumber: "GL-1002",
        dueDate: pastDue,
        payments: [],
      });

      mockPrisma.loan.count
        .mockResolvedValueOnce(5) // totalLoansEver
        .mockResolvedValueOnce(2) // settledCount
        .mockResolvedValueOnce(1); // closedCount

      mockPrisma.loan.findMany.mockResolvedValue([activeLoan, overdueLoan]);
      mockPrisma.loan.aggregate.mockResolvedValue({
        _sum: { principalPaise: BigInt(200_000_00) },
      });

      mockInterestService.calculateAccruedInterest.mockReturnValue(
        BigInt(4000),
      );
      mockInterestService.calculateOutstandingInterest.mockReturnValue(
        BigInt(4000),
      );
      mockInterestService.calculateOutstandingPrincipal.mockReturnValue(
        BigInt(100_000_00),
      );

      const result = await service.getLoanSummary();

      expect(result.totalLoansEver).toBe(5);
      expect(result.activeLoans).toBe(1);
      expect(result.overdueLoans).toBe(1);
      expect(result.settledLoans).toBe(2);
      expect(result.closedLoans).toBe(1);
      expect(result.totalPrincipalDisbursedPaise).toBe("20000000");
      // 2 loans, each has outstandingInterest(4000) + outstandingPrincipal(10000000)
      expect(result.totalCurrentOutstandingPaise).toBe("20008000");
    });
  });

  // ---------------------------------------------------------------
  // getCustomerLedger
  // ---------------------------------------------------------------

  describe("getCustomerLedger()", () => {
    it("test 11: returns customer with all loans, payments, and gold items", async () => {
      const customer = {
        id: "cust-uuid",
        fullName: "Ravi Kumar",
        mobileNumber: "9876543210",
        address: "123 Main St",
        isActive: true,
        loans: [
          {
            id: "loan-uuid",
            loanNumber: "GL-1001",
            principalPaise: BigInt(100_000_00),
            monthlyRateBps: 200,
            interestType: InterestType.FLAT_MONTHLY,
            startDate: new Date("2026-01-01"),
            dueDate: new Date("2026-04-01"),
            tenureMonths: 3,
            status: LoanStatus.ACTIVE,
            settledAt: null,
            goldItems: [
              {
                id: "gold-uuid",
                description: "22K bangle",
                weightGrams: "10.500",
                purity: "K22",
                status: "PLEDGED",
              },
            ],
            payments: [
              {
                id: "pay-uuid",
                totalAmountPaise: BigInt(6000),
                interestAmountPaise: BigInt(6000),
                principalAmountPaise: BigInt(0),
                paymentDate: new Date("2026-02-01"),
                receipt: { id: "rec-uuid", receiptNumber: "REC-10001" },
              },
            ],
          },
        ],
      };
      mockPrisma.customer.findUnique.mockResolvedValue(customer);

      const result = await service.getCustomerLedger("cust-uuid");

      expect(result.customer.id).toBe("cust-uuid");
      expect(result.customer.fullName).toBe("Ravi Kumar");
      expect(result.loans).toHaveLength(1);
      expect(result.loans[0].goldItems).toHaveLength(1);
      expect(result.loans[0].payments).toHaveLength(1);
      expect(result.loans[0].principalPaise).toBe("10000000");
    });

    it("test 12: throws NotFoundException for unknown customerId", async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.getCustomerLedger("nonexistent-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
