import { Injectable } from "@nestjs/common";
import { LoanStatus } from "@prisma/client";

@Injectable()
export class InterestService {
  /**
   * Calculate accrued interest for a flat-rate loan.
   * Uses complete months only (partial months earn no interest).
   * All values in paise (BigInt). Rate in basis points (Int).
   */
  calculateAccruedInterest(
    principalPaise: bigint,
    monthlyRateBps: number,
    startDate: Date,
    asOfDate: Date,
  ): bigint {
    const msElapsed = asOfDate.getTime() - startDate.getTime();
    if (msElapsed <= 0) return BigInt(0);
    const daysElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24));
    const completeMonths = Math.floor(daysElapsed / 30);
    if (completeMonths <= 0) return BigInt(0);
    // BigInt arithmetic: no floating point
    const monthlyInterest =
      (principalPaise * BigInt(monthlyRateBps)) / BigInt(10000);
    return monthlyInterest * BigInt(completeMonths);
  }

  calculateOutstandingInterest(
    totalAccruedPaise: bigint,
    totalInterestPaidPaise: bigint,
  ): bigint {
    const diff = totalAccruedPaise - totalInterestPaidPaise;
    return diff < BigInt(0) ? BigInt(0) : diff;
  }

  calculateOutstandingPrincipal(
    originalPrincipalPaise: bigint,
    totalPrincipalPaidPaise: bigint,
  ): bigint {
    const diff = originalPrincipalPaise - totalPrincipalPaidPaise;
    return diff < BigInt(0) ? BigInt(0) : diff;
  }

  calculateTotalOutstanding(
    outstandingPrincipalPaise: bigint,
    outstandingInterestPaise: bigint,
  ): bigint {
    return outstandingPrincipalPaise + outstandingInterestPaise;
  }

  calculateDueDate(startDate: Date, tenureMonths: number): Date {
    const due = new Date(startDate);
    due.setMonth(due.getMonth() + tenureMonths);
    return due;
  }

  isOverdue(
    dueDate: Date,
    status: LoanStatus,
    asOfDate: Date = new Date(),
  ): boolean {
    return (
      asOfDate > dueDate &&
      status !== LoanStatus.SETTLED &&
      status !== LoanStatus.CLOSED
    );
  }

  getEffectiveStatus(loan: { dueDate: Date; status: LoanStatus }): LoanStatus {
    if (
      loan.status === LoanStatus.SETTLED ||
      loan.status === LoanStatus.CLOSED
    ) {
      return loan.status;
    }
    if (new Date() > loan.dueDate) {
      return LoanStatus.OVERDUE;
    }
    return LoanStatus.ACTIVE;
  }
}
