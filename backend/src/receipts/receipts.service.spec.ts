import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import {
  AuditEventType,
  InterestType,
  LoanStatus,
  PaymentMethod,
  PaymentType,
  Permission,
  Role,
} from "@prisma/client";
import { ReceiptsService } from "./receipts.service";
import { InterestService } from "../loans/interest.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { JwtPayload } from "../common/types/jwt-payload.type";

// ---------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------

const makeOwner = (): JwtPayload => ({
  sub: "owner-uuid",
  email: "owner@example.com",
  role: Role.OWNER,
  permissions: [Permission.RECORD_PAYMENT],
});

const makeLoan = (overrides: Partial<any> = {}) => ({
  id: "loan-uuid",
  loanNumber: "GL-1001",
  customerId: "cust-uuid",
  createdById: "owner-uuid",
  principalPaise: BigInt(100_000),
  monthlyRateBps: 200, // 2% per month
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
    fullName: "Ramesh Kumar",
    mobileNumber: "9876543210",
  },
  ...overrides,
});

const makePaymentRecord = (overrides: Partial<any> = {}) => ({
  id: "payment-uuid",
  loanId: "loan-uuid",
  recordedById: "owner-uuid",
  paymentDate: new Date("2026-03-02"), // 60 days from Jan 1 = 2 complete months
  totalAmountPaise: BigInt(4_000),
  interestAmountPaise: BigInt(4_000),
  principalAmountPaise: BigInt(0),
  paymentMethod: PaymentMethod.CASH,
  paymentType: PaymentType.INTEREST_ONLY,
  referenceNumber: null,
  notes: null,
  createdAt: new Date("2026-03-02"),
  receipt: null,
  recordedBy: { id: "owner-uuid", fullName: "Owner Name" },
  loan: makeLoan(),
  ...overrides,
});

const makeReceipt = (overrides: Partial<any> = {}) => ({
  id: "receipt-uuid",
  receiptNumber: "REC-10001",
  paymentId: "payment-uuid",
  businessName: "Gold Star Loans",
  businessAddress: "123 Main Street",
  customerName: "Ramesh Kumar",
  customerMobile: "9876543210",
  loanNumber: "GL-1001",
  paymentDate: new Date("2026-03-02"),
  amountPaidPaise: BigInt(4_000),
  paymentMethod: PaymentMethod.CASH,
  outstandingAfterPaise: BigInt(100_000),
  recordedByName: "Owner Name",
  footerText: "Thank you for your payment.",
  createdAt: new Date("2026-03-02"),
  ...overrides,
});

const makeSettings = (overrides: Partial<any> = {}) => ({
  id: "singleton",
  businessName: "Gold Star Loans",
  businessAddress: "123 Main Street",
  businessPhone: "9000000000",
  defaultMonthlyRateBps: 200,
  defaultInterestType: InterestType.FLAT_MONTHLY,
  defaultTenureMonths: 3,
  currencySymbol: "Rs.",
  receiptFooterText: "Thank you for your payment.",
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

// ---------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------

let mockTx: any;

const mockPrismaService = {
  payment: { findUnique: jest.fn(), findMany: jest.fn() },
  businessSettings: { findUnique: jest.fn() },
  receipt: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
};

const mockAuditService = { log: jest.fn() };

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("ReceiptsService", () => {
  let service: ReceiptsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        InterestService, // real implementation — pure BigInt math
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ReceiptsService>(ReceiptsService);
    jest.clearAllMocks();

    // Re-build mockTx after clearAllMocks
    mockTx = {
      receipt: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };

    // Default $transaction implementation: runs callback with mockTx
    mockPrismaService.$transaction.mockImplementation((callback: any) =>
      callback(mockTx),
    );
    mockAuditService.log.mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------
  // generate() — core snapshot tests
  // ---------------------------------------------------------------

  describe("generate()", () => {
    it("test 1: creates receipt with correct snapshot — businessName, address, customerName, customerMobile, loanNumber, paymentDate, amountPaidPaise, recordedByName, footerText from settings", async () => {
      const user = makeOwner();
      const payment = makePaymentRecord();
      const settings = makeSettings();
      const receipt = makeReceipt();

      mockPrismaService.payment.findUnique.mockResolvedValue(payment);
      mockPrismaService.businessSettings.findUnique.mockResolvedValue(settings);
      mockPrismaService.payment.findMany.mockResolvedValue([payment]);
      mockTx.receipt.findFirst.mockResolvedValue(null); // no prior receipts
      mockTx.receipt.create.mockResolvedValue(receipt);

      const result = await service.generate(user, "payment-uuid");

      // Verify snapshot fields
      expect(result.businessName).toBe("Gold Star Loans");
      expect(result.businessAddress).toBe("123 Main Street");
      expect(result.customerName).toBe("Ramesh Kumar");
      expect(result.customerMobile).toBe("9876543210");
      expect(result.loanNumber).toBe("GL-1001");
      expect(result.recordedByName).toBe("Owner Name");
      expect(result.footerText).toBe("Thank you for your payment.");

      // Verify create was called with correct snapshot data
      expect(mockTx.receipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessName: "Gold Star Loans",
            businessAddress: "123 Main Street",
            customerName: "Ramesh Kumar",
            customerMobile: "9876543210",
            loanNumber: "GL-1001",
            recordedByName: "Owner Name",
            footerText: "Thank you for your payment.",
            paymentMethod: PaymentMethod.CASH,
          }),
        }),
      );
    });

    it("test 2: receiptNumber starts at REC-10001 when no prior receipts exist", async () => {
      const user = makeOwner();
      const payment = makePaymentRecord();
      const settings = makeSettings();
      const receipt = makeReceipt({ receiptNumber: "REC-10001" });

      mockPrismaService.payment.findUnique.mockResolvedValue(payment);
      mockPrismaService.businessSettings.findUnique.mockResolvedValue(settings);
      mockPrismaService.payment.findMany.mockResolvedValue([payment]);
      mockTx.receipt.findFirst.mockResolvedValue(null); // no prior receipts
      mockTx.receipt.create.mockResolvedValue(receipt);

      await service.generate(user, "payment-uuid");

      expect(mockTx.receipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ receiptNumber: "REC-10001" }),
        }),
      );
    });

    it("test 3: increments receiptNumber correctly (REC-10002 when REC-10001 already exists)", async () => {
      const user = makeOwner();
      const payment = makePaymentRecord();
      const settings = makeSettings();
      const receipt = makeReceipt({ receiptNumber: "REC-10002" });

      mockPrismaService.payment.findUnique.mockResolvedValue(payment);
      mockPrismaService.businessSettings.findUnique.mockResolvedValue(settings);
      mockPrismaService.payment.findMany.mockResolvedValue([payment]);
      // One receipt already exists
      mockTx.receipt.findFirst.mockResolvedValue({
        receiptNumber: "REC-10001",
      });
      mockTx.receipt.create.mockResolvedValue(receipt);

      await service.generate(user, "payment-uuid");

      expect(mockTx.receipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ receiptNumber: "REC-10002" }),
        }),
      );
    });

    it("test 4: throws NotFoundException when payment not found", async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.generate(makeOwner(), "non-existent"),
      ).rejects.toThrow(new NotFoundException("Payment not found"));
    });

    it("test 5: throws ConflictException when receipt already exists for payment", async () => {
      const existingReceipt = makeReceipt();
      const payment = makePaymentRecord({ receipt: existingReceipt });

      mockPrismaService.payment.findUnique.mockResolvedValue(payment);

      await expect(
        service.generate(makeOwner(), "payment-uuid"),
      ).rejects.toThrow(
        new ConflictException(
          "A receipt has already been generated for this payment",
        ),
      );
    });

    it("test 6: correctly computes outstandingAfterPaise using InterestService", async () => {
      const user = makeOwner();
      // principal = 100_000 paise, monthlyRateBps = 200, startDate = Jan 1
      // paymentDate = Mar 2 (60 days = 2 complete months)
      // accrued interest = 100_000 * 200/10000 * 2 = 4_000
      // payment covers 4_000 interest + 0 principal
      // after payment: outstanding interest = 4_000 - 4_000 = 0
      //                outstanding principal = 100_000 - 0 = 100_000
      // outstandingAfterPaise = 100_000
      const payment = makePaymentRecord({
        interestAmountPaise: BigInt(4_000),
        principalAmountPaise: BigInt(0),
        totalAmountPaise: BigInt(4_000),
      });
      const settings = makeSettings();

      let capturedCreateData: any;
      const receipt = makeReceipt({ outstandingAfterPaise: BigInt(100_000) });

      mockPrismaService.payment.findUnique.mockResolvedValue(payment);
      mockPrismaService.businessSettings.findUnique.mockResolvedValue(settings);
      mockPrismaService.payment.findMany.mockResolvedValue([payment]);
      mockTx.receipt.findFirst.mockResolvedValue(null);
      mockTx.receipt.create.mockImplementation(({ data }: any) => {
        capturedCreateData = data;
        return Promise.resolve(receipt);
      });

      await service.generate(user, "payment-uuid");

      // outstanding = 0 (interest) + 100_000 (principal) = 100_000
      expect(capturedCreateData.outstandingAfterPaise).toBe(BigInt(100_000));
    });

    it("test 7: uses settings fallback when BusinessSettings is null", async () => {
      const user = makeOwner();
      const payment = makePaymentRecord();
      const receipt = makeReceipt({
        businessName: "Gold Loan Business",
        businessAddress: "",
        footerText: null,
      });

      mockPrismaService.payment.findUnique.mockResolvedValue(payment);
      mockPrismaService.businessSettings.findUnique.mockResolvedValue(null); // settings not configured
      mockPrismaService.payment.findMany.mockResolvedValue([payment]);
      mockTx.receipt.findFirst.mockResolvedValue(null);
      mockTx.receipt.create.mockResolvedValue(receipt);

      await service.generate(user, "payment-uuid");

      // Should use fallback values — not throw
      expect(mockTx.receipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessName: "Gold Loan Business",
            businessAddress: "",
            footerText: null,
          }),
        }),
      );
    });

    it("test 8: logs RECEIPT_GENERATED audit event inside transaction", async () => {
      const user = makeOwner();
      const payment = makePaymentRecord();
      const settings = makeSettings();
      const receipt = makeReceipt();

      mockPrismaService.payment.findUnique.mockResolvedValue(payment);
      mockPrismaService.businessSettings.findUnique.mockResolvedValue(settings);
      mockPrismaService.payment.findMany.mockResolvedValue([payment]);
      mockTx.receipt.findFirst.mockResolvedValue(null);
      mockTx.receipt.create.mockResolvedValue(receipt);

      await service.generate(user, "payment-uuid");

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.RECEIPT_GENERATED,
          performedById: user.sub,
          affectedModel: "Receipt",
          affectedId: receipt.id,
          afterValue: expect.objectContaining({
            receiptNumber: receipt.receiptNumber,
            paymentId: payment.id,
            loanNumber: payment.loan.loanNumber,
          }),
        }),
        mockTx,
      );
    });
  });

  // ---------------------------------------------------------------
  // findOne()
  // ---------------------------------------------------------------

  describe("findOne()", () => {
    it("test 9: returns receipt by id", async () => {
      const receipt = makeReceipt();
      mockPrismaService.receipt.findUnique.mockResolvedValue(receipt);

      const result = await service.findOne("receipt-uuid");

      expect(result.id).toBe("receipt-uuid");
      expect(result.receiptNumber).toBe("REC-10001");
      // BigInt fields serialized as strings
      expect(typeof result.amountPaidPaise).toBe("string");
      expect(typeof result.outstandingAfterPaise).toBe("string");
    });

    it("test 10: throws NotFoundException for unknown receipt id", async () => {
      mockPrismaService.receipt.findUnique.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        new NotFoundException("Receipt not found"),
      );
    });
  });
});
