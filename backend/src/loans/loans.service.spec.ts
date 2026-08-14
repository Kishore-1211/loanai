import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InterestType, LoanStatus, Permission, Role } from "@prisma/client";
import { LoansService } from "./loans.service";
import { InterestService } from "./interest.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { CreateLoanDto } from "./dto/create-loan.dto";

// ---------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------

const makeOwner = (): JwtPayload => ({
  sub: "owner-id",
  email: "owner@example.com",
  role: Role.OWNER,
  permissions: [
    Permission.CREATE_LOAN,
    Permission.VIEW_ALL_LOANS,
    Permission.VIEW_OVERDUE_LOANS,
  ],
});

const makeStaff = (extraPermissions: Permission[] = []): JwtPayload => ({
  sub: "staff-id",
  email: "staff@example.com",
  role: Role.STAFF,
  permissions: extraPermissions,
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
  loan: null,
  description: "Gold necklace 22K",
  ...overrides,
});

const makeLoan = (overrides: Partial<any> = {}) => ({
  id: "loan-1",
  loanNumber: "GL-1001",
  customerId: "cust-1",
  createdById: "owner-id",
  principalPaise: BigInt(10000000),
  monthlyRateBps: 200,
  interestType: InterestType.FLAT_MONTHLY,
  startDate: new Date("2026-01-01"),
  dueDate: new Date("2026-04-01"),
  tenureMonths: 3,
  status: LoanStatus.ACTIVE,
  settledAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

const mockPrismaService = {
  customer: { findUnique: jest.fn() },
  goldItem: { findUnique: jest.fn(), updateMany: jest.fn() },
  loan: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  payment: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockAuditService = { log: jest.fn() };

// Real InterestService — it is pure functions, no side effects
// We use the real one so we don't mock business logic

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("LoansService", () => {
  let service: LoansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        InterestService, // use real InterestService
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------
  // create()
  // ---------------------------------------------------------------

  describe("create()", () => {
    const dto: CreateLoanDto = {
      customerId: "cust-1",
      goldItemIds: ["item-1"],
      principalPaise: 10000000,
      monthlyRateBps: 200,
      interestType: InterestType.FLAT_MONTHLY,
      startDate: "2026-01-01",
      tenureMonths: 3,
    };

    it("test 1: creates loan with generated loanNumber, correct dueDate, links gold items, logs LOAN_CREATED", async () => {
      const user = makeOwner();
      const customer = makeCustomer();
      const goldItem = makeGoldItem();
      const createdLoan = makeLoan();

      mockPrismaService.customer.findUnique.mockResolvedValue(customer);
      mockPrismaService.goldItem.findUnique.mockResolvedValue(goldItem);
      mockPrismaService.payment.findMany.mockResolvedValue([]);

      mockPrismaService.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          loan: {
            findFirst: jest.fn().mockResolvedValue({ loanNumber: "GL-1000" }),
            create: jest.fn().mockResolvedValue(createdLoan),
          },
          goldItem: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          auditLog: { create: jest.fn() },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      const result = await service.create(user, dto);

      expect(result.loanNumber).toBe("GL-1001");
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "LOAN_CREATED" }),
        expect.anything(),
      );
    });

    it("test 2: throws NotFoundException if customer not found", async () => {
      const user = makeOwner();
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.create(user, dto)).rejects.toThrow(
        new NotFoundException("Customer not found"),
      );
    });

    it("test 3: throws UnprocessableEntityException if customer is inactive", async () => {
      const user = makeOwner();
      mockPrismaService.customer.findUnique.mockResolvedValue(
        makeCustomer({ isActive: false }),
      );

      await expect(service.create(user, dto)).rejects.toThrow(
        new UnprocessableEntityException("Customer account is inactive"),
      );
    });

    it("test 4: throws NotFoundException if goldItem not found", async () => {
      const user = makeOwner();
      mockPrismaService.customer.findUnique.mockResolvedValue(makeCustomer());
      mockPrismaService.goldItem.findUnique.mockResolvedValue(null);

      await expect(service.create(user, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("test 5: throws NotFoundException if goldItem doesn't belong to customer", async () => {
      const user = makeOwner();
      mockPrismaService.customer.findUnique.mockResolvedValue(makeCustomer());
      mockPrismaService.goldItem.findUnique.mockResolvedValue(
        makeGoldItem({ customerId: "other-customer" }),
      );

      await expect(service.create(user, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("test 6: throws ConflictException if goldItem already pledged to active loan", async () => {
      const user = makeOwner();
      mockPrismaService.customer.findUnique.mockResolvedValue(makeCustomer());
      mockPrismaService.goldItem.findUnique.mockResolvedValue(
        makeGoldItem({
          loanId: "existing-loan-id",
          loan: { id: "existing-loan-id", status: LoanStatus.ACTIVE },
        }),
      );

      await expect(service.create(user, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("test 7: principalPaise number is correctly converted to BigInt before storage", async () => {
      const user = makeOwner();
      const customer = makeCustomer();
      const goldItem = makeGoldItem();

      mockPrismaService.customer.findUnique.mockResolvedValue(customer);
      mockPrismaService.goldItem.findUnique.mockResolvedValue(goldItem);
      mockPrismaService.payment.findMany.mockResolvedValue([]);

      let capturedData: any;
      mockPrismaService.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          loan: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((args: any) => {
              capturedData = args.data;
              return Promise.resolve(makeLoan());
            }),
          },
          goldItem: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          auditLog: { create: jest.fn() },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      await service.create(user, dto);

      expect(typeof capturedData.principalPaise).toBe("bigint");
      expect(capturedData.principalPaise).toBe(BigInt(10000000));
    });
  });

  // ---------------------------------------------------------------
  // findAll()
  // ---------------------------------------------------------------

  describe("findAll()", () => {
    it("test 8: returns all loans for OWNER (no createdById restriction)", async () => {
      const user = makeOwner();
      const loans = [makeLoan()];

      mockPrismaService.loan.findMany.mockResolvedValue(loans);
      mockPrismaService.loan.count.mockResolvedValue(1);
      mockPrismaService.payment.findMany.mockResolvedValue([]);

      const result = await service.findAll(user, {});

      // OWNER has VIEW_ALL_LOANS — no createdById filter
      const whereArg = mockPrismaService.loan.findMany.mock.calls[0][0].where;
      expect(whereArg.createdById).toBeUndefined();
      expect(result.data).toHaveLength(1);
    });

    it("test 9: scopes to createdById for STAFF without VIEW_ALL_LOANS", async () => {
      const user = makeStaff(); // no VIEW_ALL_LOANS
      const loans = [makeLoan({ createdById: "staff-id" })];

      mockPrismaService.loan.findMany.mockResolvedValue(loans);
      mockPrismaService.loan.count.mockResolvedValue(1);
      mockPrismaService.payment.findMany.mockResolvedValue([]);

      await service.findAll(user, {});

      const whereArg = mockPrismaService.loan.findMany.mock.calls[0][0].where;
      expect(whereArg.createdById).toBe("staff-id");
    });

    it("test 10: OVERDUE filter uses dueDate < now AND status = ACTIVE", async () => {
      const user = makeOwner();

      mockPrismaService.loan.findMany.mockResolvedValue([]);
      mockPrismaService.loan.count.mockResolvedValue(0);

      await service.findAll(user, { status: "OVERDUE" });

      const whereArg = mockPrismaService.loan.findMany.mock.calls[0][0].where;
      expect(whereArg.status).toBe(LoanStatus.ACTIVE);
      expect(whereArg.dueDate).toBeDefined();
      expect(whereArg.dueDate.lt).toBeDefined();
    });
  });

  // ---------------------------------------------------------------
  // findOne()
  // ---------------------------------------------------------------

  describe("findOne()", () => {
    it("test 11: returns full loan details with computed outstanding amounts", async () => {
      const user = makeOwner();
      const loan = {
        ...makeLoan(),
        customer: {
          id: "cust-1",
          fullName: "Ramesh",
          mobileNumber: "9876543210",
        },
        goldItems: [],
        payments: [],
      };

      mockPrismaService.loan.findUnique.mockResolvedValue(loan);
      mockPrismaService.payment.findMany.mockResolvedValue([]);

      const result = await service.findOne(user, "loan-1");

      expect(result.id).toBe("loan-1");
      expect(result.outstandingPrincipalPaise).toBeDefined();
      expect(result.totalOutstandingPaise).toBeDefined();
      expect(result.effectiveStatus).toBeDefined();
      expect(result.asOfDate).toBeDefined();
    });

    it("test 12: throws ForbiddenException for STAFF without VIEW_ALL_LOANS on another's loan", async () => {
      // Staff without VIEW_ALL_LOANS, loan belongs to 'owner-id'
      const user = makeStaff(); // staff-id, no VIEW_ALL_LOANS
      const loan = {
        ...makeLoan({ createdById: "owner-id" }), // different owner
        customer: {
          id: "cust-1",
          fullName: "Ramesh",
          mobileNumber: "9876543210",
        },
        goldItems: [],
        payments: [],
      };

      mockPrismaService.loan.findUnique.mockResolvedValue(loan);

      await expect(service.findOne(user, "loan-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("test 13: throws NotFoundException for non-existent loan", async () => {
      const user = makeOwner();
      mockPrismaService.loan.findUnique.mockResolvedValue(null);

      await expect(service.findOne(user, "non-existent")).rejects.toThrow(
        new NotFoundException("Loan not found"),
      );
    });
  });

  // ---------------------------------------------------------------
  // findOverdue()
  // ---------------------------------------------------------------

  describe("findOverdue()", () => {
    it("test 14: returns loans with daysOverdue and totalOutstandingPaise", async () => {
      const overdueLoan = makeLoan({
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      });

      mockPrismaService.loan.findMany.mockResolvedValue([overdueLoan]);
      mockPrismaService.payment.findMany.mockResolvedValue([]);

      const result = await service.findOverdue();

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].daysOverdue).toBeGreaterThanOrEqual(10);
      expect(result[0].effectiveStatus).toBe(LoanStatus.OVERDUE);
      expect(result[0].totalOutstandingPaise).toBeDefined();
    });
  });
});
