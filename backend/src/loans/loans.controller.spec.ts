import { Test, TestingModule } from "@nestjs/testing";
import { InterestType, LoanStatus, Permission, Role } from "@prisma/client";
import { LoansController } from "./loans.controller";
import { LoansService } from "./loans.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { CreateLoanDto } from "./dto/create-loan.dto";
import { LoanQueryDto } from "./dto/loan-query.dto";

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

const makeLoanResponse = (overrides: Partial<any> = {}) => ({
  id: "loan-1",
  loanNumber: "GL-1001",
  customerId: "cust-1",
  principalPaise: "10000000",
  monthlyRateBps: 200,
  interestType: InterestType.FLAT_MONTHLY,
  startDate: "2026-01-01T00:00:00.000Z",
  dueDate: "2026-04-01T00:00:00.000Z",
  tenureMonths: 3,
  status: LoanStatus.ACTIVE,
  effectiveStatus: LoanStatus.ACTIVE,
  totalOutstandingPaise: "10000000",
  ...overrides,
});

// ---------------------------------------------------------------
// Mock service
// ---------------------------------------------------------------

const mockLoansService = {
  findAll: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  findOverdue: jest.fn(),
  findDueSoon: jest.fn(),
};

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("LoansController", () => {
  let controller: LoansController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoansController],
      providers: [{ provide: LoansService, useValue: mockLoansService }],
    }).compile();

    controller = module.get<LoansController>(LoansController);
    jest.clearAllMocks();
  });

  it("test 1: controller should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll()", () => {
    it("test 2: delegates to loansService.findAll with user and query", async () => {
      const user = makeOwner();
      const query: LoanQueryDto = { page: 1, pageSize: 20 };
      const expected = {
        data: [makeLoanResponse()],
        meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
      };

      mockLoansService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(user, query);

      expect(mockLoansService.findAll).toHaveBeenCalledWith(user, query);
      expect(result).toEqual(expected);
    });
  });

  describe("create()", () => {
    it("test 3: delegates to loansService.create with user and dto", async () => {
      const user = makeOwner();
      const dto: CreateLoanDto = {
        customerId: "cust-1",
        goldItemIds: ["item-1"],
        principalPaise: 10000000,
        monthlyRateBps: 200,
        interestType: InterestType.FLAT_MONTHLY,
        startDate: "2026-01-01",
        tenureMonths: 3,
      };
      const expected = makeLoanResponse();

      mockLoansService.create.mockResolvedValue(expected);

      const result = await controller.create(user, dto);

      expect(mockLoansService.create).toHaveBeenCalledWith(user, dto);
      expect(result).toEqual(expected);
    });
  });

  describe("findOne()", () => {
    it("test 4: delegates to loansService.findOne with user and id", async () => {
      const user = makeOwner();
      const expected = {
        ...makeLoanResponse(),
        customer: {
          id: "cust-1",
          fullName: "Ramesh",
          mobileNumber: "9876543210",
        },
        goldItems: [],
        payments: [],
      };

      mockLoansService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne(user, "loan-1");

      expect(mockLoansService.findOne).toHaveBeenCalledWith(user, "loan-1");
      expect(result).toEqual(expected);
    });
  });

  describe("findOverdue()", () => {
    it("test 5: delegates to loansService.findOverdue", async () => {
      const expected = [
        {
          ...makeLoanResponse(),
          daysOverdue: 10,
          effectiveStatus: LoanStatus.OVERDUE,
        },
      ];

      mockLoansService.findOverdue.mockResolvedValue(expected);

      const result = await controller.findOverdue();

      expect(mockLoansService.findOverdue).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe("findDueSoon()", () => {
    it("test 6: delegates to loansService.findDueSoon", async () => {
      const expected = [makeLoanResponse()];

      mockLoansService.findDueSoon.mockResolvedValue(expected);

      const result = await controller.findDueSoon();

      expect(mockLoansService.findDueSoon).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });
});
