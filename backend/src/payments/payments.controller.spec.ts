import { Test, TestingModule } from "@nestjs/testing";
import { PaymentMethod, Permission, Role } from "@prisma/client";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { RecordPaymentDto } from "./dto/record-payment.dto";

// ---------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------

const makeOwner = (): JwtPayload => ({
  sub: "owner-uuid",
  email: "owner@example.com",
  role: Role.OWNER,
  permissions: [Permission.RECORD_PAYMENT],
});

const mockPaymentsService = {
  recordPayment: jest.fn(),
  findOne: jest.fn(),
  findByLoanId: jest.fn(),
};

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("PaymentsController", () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    jest.clearAllMocks();
  });

  it("test 1: PaymentsController is defined", () => {
    expect(controller).toBeDefined();
  });

  describe("recordPayment()", () => {
    it("test 2: delegates to paymentsService.recordPayment with currentUser and dto", async () => {
      const user = makeOwner();
      const dto: RecordPaymentDto = {
        loanId: "loan-uuid",
        paymentDate: "2026-03-01",
        totalAmountPaise: 5_000,
        paymentMethod: PaymentMethod.CASH,
      };
      const expected = { id: "payment-uuid", totalAmountPaise: "5000" };

      mockPaymentsService.recordPayment.mockResolvedValue(expected);

      const result = await controller.recordPayment(user, dto);

      expect(mockPaymentsService.recordPayment).toHaveBeenCalledWith(user, dto);
      expect(result).toEqual(expected);
    });
  });

  describe("findOne()", () => {
    it("test 3: delegates to paymentsService.findOne with id", async () => {
      const expected = { id: "payment-uuid", loanId: "loan-uuid" };
      mockPaymentsService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne("payment-uuid");

      expect(mockPaymentsService.findOne).toHaveBeenCalledWith("payment-uuid");
      expect(result).toEqual(expected);
    });
  });
});
