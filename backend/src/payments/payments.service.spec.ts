import { Test, TestingModule } from "@nestjs/testing";
import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  AuditEventType,
  GoldItemStatus,
  InterestType,
  LoanStatus,
  PaymentMethod,
  PaymentType,
  Permission,
  Role,
} from "@prisma/client";
import { PaymentsService } from "./payments.service";
import { InterestService } from "../loans/interest.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { RecordPaymentDto } from "./dto/record-payment.dto";

// ---------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------

const makeOwner = (): JwtPayload => ({
  sub: "owner-uuid",
  email: "owner@example.com",
  role: Role.OWNER,
  permissions: [Permission.RECORD_PAYMENT, Permission.VIEW_ALL_LOANS],
});

const makeLoan = (overrides: Partial<any> = {}) => ({
  id: "loan-uuid",
  loanNumber: "GL-1001",
  customerId: "cust-uuid",
  createdById: "owner-uuid",
  principalPaise: BigInt(10_000_00), // 10000 rupees = 1,000,000 paise
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
  ...overrides,
});

const makePaymentRecord = (overrides: Partial<any> = {}) => ({
  id: "payment-uuid",
  loanId: "loan-uuid",
  recordedById: "owner-uuid",
  paymentDate: new Date("2026-03-01"),
  totalAmountPaise: BigInt(2000),
  interestAmountPaise: BigInt(2000),
  principalAmountPaise: BigInt(0),
  paymentMethod: PaymentMethod.CASH,
  paymentType: PaymentType.INTEREST_ONLY,
  referenceNumber: null,
  notes: null,
  createdAt: new Date("2026-03-01"),
  ...overrides,
});

const makeDto = (
  overrides: Partial<RecordPaymentDto> = {},
): RecordPaymentDto => ({
  loanId: "loan-uuid",
  paymentDate: "2026-03-01",
  totalAmountPaise: 2000,
  paymentMethod: PaymentMethod.CASH,
  ...overrides,
});

// ---------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------

// mockTx is the transaction client passed to the callback
let mockTx: any;

const mockPrismaService = {
  loan: { findUnique: jest.fn() },
  payment: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  goldItem: { updateMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockAuditService = { log: jest.fn() };

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("PaymentsService", () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        InterestService, // real implementation — pure BigInt math
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();

    // Re-build mockTx after clearAllMocks
    mockTx = {
      loan: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      goldItem: {
        updateMany: jest.fn(),
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
  // recordPayment() — allocation tests
  // ---------------------------------------------------------------

  describe("recordPayment()", () => {
    it("test 1: payment less than outstanding interest → all goes to interest (INTEREST_ONLY), loan stays active", async () => {
      const user = makeOwner();
      const loan = makeLoan({ principalPaise: BigInt(1_000_000) });
      // 2 months elapsed, 2% rate → accrued = 1_000_000 * 200/10000 * 2 = 40_000 paise
      // outstanding interest = 40_000, outstanding principal = 1_000_000
      // payment = 10_000 paise → all goes to interest

      mockTx.loan.findUnique.mockResolvedValue(loan);
      mockTx.payment.findMany.mockResolvedValue([]); // no prior payments

      const paymentRecord = makePaymentRecord({
        totalAmountPaise: BigInt(10_000),
        interestAmountPaise: BigInt(10_000),
        principalAmountPaise: BigInt(0),
        paymentType: PaymentType.INTEREST_ONLY,
      });
      mockTx.payment.create.mockResolvedValue(paymentRecord);

      const dto = makeDto({
        paymentDate: "2026-03-01", // 59 days after Jan 1 → 1 complete month
        totalAmountPaise: 10_000,
      });

      const result = await service.recordPayment(user, dto);

      // Should be INTEREST_ONLY
      expect(result.paymentType).toBe(PaymentType.INTEREST_ONLY);
      // Loan should NOT be updated (not settled)
      expect(mockTx.loan.update).not.toHaveBeenCalled();
      expect(mockTx.goldItem.updateMany).not.toHaveBeenCalled();
    });

    it("test 2: payment covers all interest + some principal → PRINCIPAL_AND_INTEREST split", async () => {
      const user = makeOwner();
      // principalPaise = 100_000 paise; monthlyRateBps = 200
      // paymentDate 2026-03-01 (60 days after Jan 1 = 2 complete months)
      // accruedInterest = 100_000 * 200/10000 * 2 = 4_000
      // payment = 5_000 → interestAmount=4_000, principalAmount=1_000
      const loan = makeLoan({ principalPaise: BigInt(100_000) });
      mockTx.loan.findUnique.mockResolvedValue(loan);
      mockTx.payment.findMany.mockResolvedValue([]); // no prior payments

      const paymentRecord = makePaymentRecord({
        totalAmountPaise: BigInt(5_000),
        interestAmountPaise: BigInt(4_000),
        principalAmountPaise: BigInt(1_000),
        paymentType: PaymentType.PRINCIPAL_AND_INTEREST,
      });
      mockTx.payment.create.mockResolvedValue(paymentRecord);

      const dto = makeDto({
        paymentDate: "2026-03-02", // 60 days → 2 months
        totalAmountPaise: 5_000,
      });

      const result = await service.recordPayment(user, dto);

      expect(result.paymentType).toBe(PaymentType.PRINCIPAL_AND_INTEREST);
      // Not fully settled
      expect(mockTx.loan.update).not.toHaveBeenCalled();
    });

    it("test 3: payment covers full outstanding → loan SETTLED, gold items RELEASED, paymentType FULL_SETTLEMENT", async () => {
      const user = makeOwner();
      // principal = 100_000, rate 2%/month
      // paymentDate 2026-03-02 = 60 days = 2 months
      // accrued interest = 4_000, outstanding principal = 100_000
      // payment = 104_000 → full settlement
      const loan = makeLoan({ principalPaise: BigInt(100_000) });
      mockTx.loan.findUnique.mockResolvedValue(loan);
      mockTx.payment.findMany.mockResolvedValue([]);

      const paymentRecord = makePaymentRecord({
        totalAmountPaise: BigInt(104_000),
        interestAmountPaise: BigInt(4_000),
        principalAmountPaise: BigInt(100_000),
        paymentType: PaymentType.FULL_SETTLEMENT,
      });
      mockTx.payment.create.mockResolvedValue(paymentRecord);
      mockTx.loan.update.mockResolvedValue({});
      mockTx.goldItem.updateMany.mockResolvedValue({ count: 1 });

      const dto = makeDto({
        paymentDate: "2026-03-02",
        totalAmountPaise: 104_000,
      });

      const result = await service.recordPayment(user, dto);

      expect(result.paymentType).toBe(PaymentType.FULL_SETTLEMENT);
      expect(mockTx.loan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "loan-uuid" },
          data: expect.objectContaining({ status: LoanStatus.SETTLED }),
        }),
      );
      expect(mockTx.goldItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { loanId: "loan-uuid" },
          data: { status: GoldItemStatus.RELEASED },
        }),
      );
      expect(result.loanStatusAfter).toBe(LoanStatus.SETTLED);
    });

    it("test 4: partial payment: outstandingAfterPaise reduced correctly", async () => {
      const user = makeOwner();
      // principal = 100_000, rate 2%/month, 2 months
      // accrued = 4_000, outstanding principal = 100_000
      // total outstanding = 104_000
      // pay 3_000 → interestAmount=3_000, principalAmount=0
      // outstanding after = (4_000-3_000) + 100_000 = 101_000
      const loan = makeLoan({ principalPaise: BigInt(100_000) });
      mockTx.loan.findUnique.mockResolvedValue(loan);
      mockTx.payment.findMany.mockResolvedValue([]);

      const paymentRecord = makePaymentRecord({
        totalAmountPaise: BigInt(3_000),
        interestAmountPaise: BigInt(3_000),
        principalAmountPaise: BigInt(0),
        paymentType: PaymentType.INTEREST_ONLY,
      });
      mockTx.payment.create.mockResolvedValue(paymentRecord);

      const dto = makeDto({
        paymentDate: "2026-03-02",
        totalAmountPaise: 3_000,
      });

      const result = await service.recordPayment(user, dto);

      // outstandingAfterPaise should be (4000-3000) + (100000-0) = 101000
      expect(result.outstandingAfterPaise).toBe("101000");
    });

    it("test 5: overpayment (tender > outstanding): actualTotalPaise capped at outstanding; loan SETTLED", async () => {
      const user = makeOwner();
      // principal = 100_000, 2 months, rate 2% → accrued=4_000
      // total outstanding = 104_000
      // customer tenders 200_000 (overpayment)
      // actualTotal should be capped at 104_000
      const loan = makeLoan({ principalPaise: BigInt(100_000) });
      mockTx.loan.findUnique.mockResolvedValue(loan);
      mockTx.payment.findMany.mockResolvedValue([]);

      // Capture the create call's data to verify capping
      let capturedData: any;
      mockTx.payment.create.mockImplementation(({ data }: any) => {
        capturedData = data;
        return Promise.resolve(
          makePaymentRecord({
            totalAmountPaise: data.totalAmountPaise,
            interestAmountPaise: data.interestAmountPaise,
            principalAmountPaise: data.principalAmountPaise,
            paymentType: PaymentType.FULL_SETTLEMENT,
          }),
        );
      });
      mockTx.loan.update.mockResolvedValue({});
      mockTx.goldItem.updateMany.mockResolvedValue({ count: 1 });

      const dto = makeDto({
        paymentDate: "2026-03-02",
        totalAmountPaise: 200_000,
      });

      await service.recordPayment(user, dto);

      // actualTotal must be capped at outstanding (104_000), not the tendered 200_000
      expect(capturedData.totalAmountPaise).toBe(BigInt(104_000));
      expect(capturedData.interestAmountPaise).toBe(BigInt(4_000));
      expect(capturedData.principalAmountPaise).toBe(BigInt(100_000));
    });

    it("test 6: throws NotFoundException for non-existent loan", async () => {
      mockTx.loan.findUnique.mockResolvedValue(null);

      const dto = makeDto({ loanId: "non-existent-uuid" });

      await expect(service.recordPayment(makeOwner(), dto)).rejects.toThrow(
        new NotFoundException("Loan not found"),
      );
    });

    it("test 7: throws UnprocessableEntityException for SETTLED loan", async () => {
      mockTx.loan.findUnique.mockResolvedValue(
        makeLoan({ status: LoanStatus.SETTLED }),
      );

      await expect(
        service.recordPayment(makeOwner(), makeDto()),
      ).rejects.toThrow(
        new UnprocessableEntityException(
          "Cannot record payment on a settled or closed loan",
        ),
      );
    });

    it("test 8: throws UnprocessableEntityException for CLOSED loan", async () => {
      mockTx.loan.findUnique.mockResolvedValue(
        makeLoan({ status: LoanStatus.CLOSED }),
      );

      await expect(
        service.recordPayment(makeOwner(), makeDto()),
      ).rejects.toThrow(
        new UnprocessableEntityException(
          "Cannot record payment on a settled or closed loan",
        ),
      );
    });

    it("test 9: creates audit log with PAYMENT_RECORDED event inside transaction", async () => {
      const user = makeOwner();
      const loan = makeLoan({ principalPaise: BigInt(100_000) });
      mockTx.loan.findUnique.mockResolvedValue(loan);
      mockTx.payment.findMany.mockResolvedValue([]);
      mockTx.payment.create.mockResolvedValue(
        makePaymentRecord({ totalAmountPaise: BigInt(1_000) }),
      );

      const dto = makeDto({
        paymentDate: "2026-03-02",
        totalAmountPaise: 1_000,
      });
      await service.recordPayment(user, dto);

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.PAYMENT_RECORDED,
          performedById: user.sub,
          affectedModel: "Payment",
        }),
        mockTx,
      );
    });

    it("test 10: interestAmountPaise + principalAmountPaise === actualTotalPaise (invariant)", async () => {
      const user = makeOwner();
      const loan = makeLoan({ principalPaise: BigInt(100_000) });
      mockTx.loan.findUnique.mockResolvedValue(loan);
      mockTx.payment.findMany.mockResolvedValue([]);

      let capturedData: any;
      mockTx.payment.create.mockImplementation(({ data }: any) => {
        capturedData = data;
        return Promise.resolve(
          makePaymentRecord({
            totalAmountPaise: data.totalAmountPaise,
            interestAmountPaise: data.interestAmountPaise,
            principalAmountPaise: data.principalAmountPaise,
          }),
        );
      });

      const dto = makeDto({
        paymentDate: "2026-03-02",
        totalAmountPaise: 5_000,
      });
      await service.recordPayment(user, dto);

      expect(capturedData.totalAmountPaise).toBe(
        capturedData.interestAmountPaise + capturedData.principalAmountPaise,
      );
    });

    it("test 11: BigInt values serialized as strings in response (not raw BigInt)", async () => {
      const user = makeOwner();
      const loan = makeLoan({ principalPaise: BigInt(100_000) });
      mockTx.loan.findUnique.mockResolvedValue(loan);
      mockTx.payment.findMany.mockResolvedValue([]);
      mockTx.payment.create.mockResolvedValue(
        makePaymentRecord({
          totalAmountPaise: BigInt(1_000),
          interestAmountPaise: BigInt(1_000),
          principalAmountPaise: BigInt(0),
        }),
      );

      const dto = makeDto({
        paymentDate: "2026-03-02",
        totalAmountPaise: 1_000,
      });
      const result = await service.recordPayment(user, dto);

      // All BigInt fields must be returned as strings
      expect(typeof result.totalAmountPaise).toBe("string");
      expect(typeof result.interestAmountPaise).toBe("string");
      expect(typeof result.principalAmountPaise).toBe("string");
      expect(typeof result.outstandingAfterPaise).toBe("string");
    });
  });

  // ---------------------------------------------------------------
  // findOne()
  // ---------------------------------------------------------------

  describe("findOne()", () => {
    it("test 12: returns payment with recordedBy and receipt references", async () => {
      const paymentRecord = {
        ...makePaymentRecord(),
        recordedBy: { id: "owner-uuid", fullName: "Owner Name" },
        receipt: { id: "receipt-uuid", receiptNumber: "REC-001" },
        loan: { id: "loan-uuid", loanNumber: "GL-1001" },
      };
      mockPrismaService.payment.findUnique.mockResolvedValue(paymentRecord);

      const result = await service.findOne("payment-uuid");

      expect(result.id).toBe("payment-uuid");
      expect(result.recordedBy).toEqual({
        id: "owner-uuid",
        fullName: "Owner Name",
      });
      expect(result.receipt).toEqual({
        id: "receipt-uuid",
        receiptNumber: "REC-001",
      });
    });

    it("test 13: throws NotFoundException for unknown payment id", async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        new NotFoundException("Payment not found"),
      );
    });
  });

  // ---------------------------------------------------------------
  // findByLoanId()
  // ---------------------------------------------------------------

  describe("findByLoanId()", () => {
    it("test 14: returns payments ordered by paymentDate ascending", async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(makeLoan());
      const payments = [
        makePaymentRecord({ id: "pay-1", paymentDate: new Date("2026-02-01") }),
        makePaymentRecord({ id: "pay-2", paymentDate: new Date("2026-03-01") }),
      ];
      mockPrismaService.payment.findMany.mockResolvedValue(payments);

      const result = await service.findByLoanId("loan-uuid");

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      // Verify findMany was called with correct ordering
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { paymentDate: "asc" },
          where: { loanId: "loan-uuid" },
        }),
      );
    });
  });
});
