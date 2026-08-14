import { Test, TestingModule } from "@nestjs/testing";
import { Permission, Role } from "@prisma/client";
import { ReceiptsController } from "./receipts.controller";
import { ReceiptsService } from "./receipts.service";
import { JwtPayload } from "../common/types/jwt-payload.type";

// ---------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------

const makeOwner = (): JwtPayload => ({
  sub: "owner-uuid",
  email: "owner@example.com",
  role: Role.OWNER,
  permissions: [Permission.RECORD_PAYMENT],
});

const mockReceiptsService = {
  generate: jest.fn(),
  findOne: jest.fn(),
  findByPaymentId: jest.fn(),
};

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("ReceiptsController", () => {
  let controller: ReceiptsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReceiptsController],
      providers: [{ provide: ReceiptsService, useValue: mockReceiptsService }],
    }).compile();

    controller = module.get<ReceiptsController>(ReceiptsController);
    jest.clearAllMocks();
  });

  it("test 1: ReceiptsController is defined", () => {
    expect(controller).toBeDefined();
  });

  describe("generate()", () => {
    it("test 2: delegates to receiptsService.generate with currentUser and paymentId", async () => {
      const user = makeOwner();
      const paymentId = "payment-uuid";
      const expected = {
        id: "receipt-uuid",
        receiptNumber: "REC-10001",
        paymentId,
        amountPaidPaise: "4000",
      };

      mockReceiptsService.generate.mockResolvedValue(expected);

      const result = await controller.generate(user, paymentId);

      expect(mockReceiptsService.generate).toHaveBeenCalledWith(
        user,
        paymentId,
      );
      expect(result).toEqual(expected);
    });
  });

  describe("findOne()", () => {
    it("test 3: delegates to receiptsService.findOne with id", async () => {
      const expected = {
        id: "receipt-uuid",
        receiptNumber: "REC-10001",
        amountPaidPaise: "4000",
      };
      mockReceiptsService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne("receipt-uuid");

      expect(mockReceiptsService.findOne).toHaveBeenCalledWith("receipt-uuid");
      expect(result).toEqual(expected);
    });
  });
});
