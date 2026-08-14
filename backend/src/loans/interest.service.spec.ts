import { Test, TestingModule } from "@nestjs/testing";
import { LoanStatus } from "@prisma/client";
import { InterestService } from "./interest.service";

describe("InterestService", () => {
  let service: InterestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InterestService],
    }).compile();

    service = module.get<InterestService>(InterestService);
  });

  // ---------------------------------------------------------------
  // calculateAccruedInterest
  // ---------------------------------------------------------------

  describe("calculateAccruedInterest()", () => {
    const principal = BigInt(10000000); // Rs. 1,00,000 in paise
    const rate = 200; // 2% per month (200 bps)

    it("test 1: returns BigInt(0) when 0 days elapsed", () => {
      const date = new Date("2026-01-01");
      const result = service.calculateAccruedInterest(
        principal,
        rate,
        date,
        date,
      );
      expect(result).toBe(BigInt(0));
    });

    it("test 2: returns BigInt(200000) for exactly 30 days (1 complete month)", () => {
      const start = new Date("2026-01-01");
      const asOf = new Date("2026-01-31"); // exactly 30 days
      const result = service.calculateAccruedInterest(
        principal,
        rate,
        start,
        asOf,
      );
      expect(result).toBe(BigInt(200000));
    });

    it("test 3 (AC-INT-001): returns BigInt(600000) for exactly 90 days (3 complete months)", () => {
      const start = new Date("2026-01-01");
      const asOf = new Date("2026-04-01"); // exactly 90 days
      const result = service.calculateAccruedInterest(
        principal,
        rate,
        start,
        asOf,
      );
      expect(result).toBe(BigInt(600000));
    });

    it("test 4: returns BigInt(0) for 29 days elapsed (partial month earns 0)", () => {
      const start = new Date("2026-01-01");
      const asOf = new Date("2026-01-30"); // 29 days
      const result = service.calculateAccruedInterest(
        principal,
        rate,
        start,
        asOf,
      );
      expect(result).toBe(BigInt(0));
    });

    it("test 5: returns BigInt(200000) for 45 days elapsed (1 complete month)", () => {
      const start = new Date("2026-01-01");
      const asOf = new Date("2026-02-15"); // 45 days
      const result = service.calculateAccruedInterest(
        principal,
        rate,
        start,
        asOf,
      );
      expect(result).toBe(BigInt(200000));
    });

    it("test 6: returns BigInt(0) when asOfDate is before startDate", () => {
      const start = new Date("2026-06-01");
      const asOf = new Date("2026-01-01"); // before start
      const result = service.calculateAccruedInterest(
        principal,
        rate,
        start,
        asOf,
      );
      expect(result).toBe(BigInt(0));
    });
  });

  // ---------------------------------------------------------------
  // calculateOutstandingInterest
  // ---------------------------------------------------------------

  describe("calculateOutstandingInterest()", () => {
    it("test 7: returns BigInt(400000) when accrued=600000n, paid=200000n", () => {
      const result = service.calculateOutstandingInterest(
        BigInt(600000),
        BigInt(200000),
      );
      expect(result).toBe(BigInt(400000));
    });

    it("test 8: returns BigInt(0) when accrued equals paid exactly", () => {
      const result = service.calculateOutstandingInterest(
        BigInt(600000),
        BigInt(600000),
      );
      expect(result).toBe(BigInt(0));
    });

    it("test 9: returns BigInt(0) when overpaid (floors at 0)", () => {
      const result = service.calculateOutstandingInterest(
        BigInt(600000),
        BigInt(700000),
      );
      expect(result).toBe(BigInt(0));
    });
  });

  // ---------------------------------------------------------------
  // calculateOutstandingPrincipal
  // ---------------------------------------------------------------

  describe("calculateOutstandingPrincipal()", () => {
    it("test 10: returns BigInt(8000000) when original=10000000n, paid=2000000n", () => {
      const result = service.calculateOutstandingPrincipal(
        BigInt(10000000),
        BigInt(2000000),
      );
      expect(result).toBe(BigInt(8000000));
    });

    it("test 11: returns BigInt(0) when fully paid", () => {
      const result = service.calculateOutstandingPrincipal(
        BigInt(10000000),
        BigInt(10000000),
      );
      expect(result).toBe(BigInt(0));
    });
  });

  // ---------------------------------------------------------------
  // calculateTotalOutstanding
  // ---------------------------------------------------------------

  describe("calculateTotalOutstanding()", () => {
    it("test 12: returns BigInt(8400000) when principal=8000000n, interest=400000n", () => {
      const result = service.calculateTotalOutstanding(
        BigInt(8000000),
        BigInt(400000),
      );
      expect(result).toBe(BigInt(8400000));
    });
  });

  // ---------------------------------------------------------------
  // calculateDueDate
  // ---------------------------------------------------------------

  describe("calculateDueDate()", () => {
    it("test 13: returns 2026-11-01 for start=2026-08-01, tenure=3 months", () => {
      const start = new Date("2026-08-01");
      const due = service.calculateDueDate(start, 3);
      expect(due.getFullYear()).toBe(2026);
      expect(due.getMonth()).toBe(10); // November = 10 (0-indexed)
      expect(due.getDate()).toBe(1);
    });
  });

  // ---------------------------------------------------------------
  // isOverdue
  // ---------------------------------------------------------------

  describe("isOverdue()", () => {
    it("test 14: returns true when dueDate is in the past and status is ACTIVE", () => {
      const pastDate = new Date("2020-01-01");
      const result = service.isOverdue(pastDate, LoanStatus.ACTIVE);
      expect(result).toBe(true);
    });

    it("test 15: returns false when dueDate is in the past but status is SETTLED", () => {
      const pastDate = new Date("2020-01-01");
      const result = service.isOverdue(pastDate, LoanStatus.SETTLED);
      expect(result).toBe(false);
    });
  });
});
