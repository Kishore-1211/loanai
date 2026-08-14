import { Test, TestingModule } from "@nestjs/testing";
import { LoanPaymentsController } from "./loan-payments.controller";
import { PaymentsService } from "./payments.service";

// ---------------------------------------------------------------
// Mock service
// ---------------------------------------------------------------

const mockPaymentsService = {
  recordPayment: jest.fn(),
  findOne: jest.fn(),
  findByLoanId: jest.fn(),
};

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("LoanPaymentsController", () => {
  let controller: LoanPaymentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoanPaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    }).compile();

    controller = module.get<LoanPaymentsController>(LoanPaymentsController);
    jest.clearAllMocks();
  });

  it("test 1: LoanPaymentsController is defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findByLoanId()", () => {
    it("test 2: delegates to paymentsService.findByLoanId with loanId", async () => {
      const expected = [{ id: "payment-uuid", loanId: "loan-uuid" }];
      mockPaymentsService.findByLoanId.mockResolvedValue(expected);

      const result = await controller.findByLoanId("loan-uuid");

      expect(mockPaymentsService.findByLoanId).toHaveBeenCalledWith(
        "loan-uuid",
      );
      expect(result).toEqual(expected);
    });
  });
});
