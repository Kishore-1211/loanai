import { Injectable, NotFoundException } from "@nestjs/common";
import { LoanStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InterestService } from "../loans/interest.service";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly interestService: InterestService,
  ) {}

  // ---------------------------------------------------------------
  // getDailyCollection()
  // ---------------------------------------------------------------

  async getDailyCollection(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const payments = await this.prisma.payment.findMany({
      where: { paymentDate: { gte: targetDate, lt: nextDay } },
      include: {
        loan: {
          include: {
            customer: {
              select: { id: true, fullName: true, mobileNumber: true },
            },
          },
        },
        recordedBy: { select: { id: true, fullName: true } },
        receipt: { select: { id: true, receiptNumber: true } },
      },
      orderBy: { paymentDate: "asc" },
    });

    const totalCollectedPaise = payments.reduce(
      (s, p) => s + BigInt(p.totalAmountPaise),
      0n,
    );
    const interestCollectedPaise = payments.reduce(
      (s, p) => s + BigInt(p.interestAmountPaise),
      0n,
    );
    const principalCollectedPaise = payments.reduce(
      (s, p) => s + BigInt(p.principalAmountPaise),
      0n,
    );

    return this.serialize({
      date: targetDate.toISOString().split("T")[0],
      totalCollectedPaise,
      interestCollectedPaise,
      principalCollectedPaise,
      paymentCount: payments.length,
      payments,
    });
  }

  // ---------------------------------------------------------------
  // getMonthlyCollection()
  // ---------------------------------------------------------------

  async getMonthlyCollection(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const payments = await this.prisma.payment.findMany({
      where: { paymentDate: { gte: start, lt: end } },
      orderBy: { paymentDate: "asc" },
    });

    const totalCollectedPaise = payments.reduce(
      (s, p) => s + BigInt(p.totalAmountPaise),
      0n,
    );
    const interestCollectedPaise = payments.reduce(
      (s, p) => s + BigInt(p.interestAmountPaise),
      0n,
    );
    const principalCollectedPaise = payments.reduce(
      (s, p) => s + BigInt(p.principalAmountPaise),
      0n,
    );

    const dailyMap = new Map<string, { totalPaise: bigint; count: number }>();
    for (const p of payments) {
      const key = p.paymentDate.toISOString().split("T")[0];
      if (!dailyMap.has(key)) dailyMap.set(key, { totalPaise: 0n, count: 0 });
      const entry = dailyMap.get(key)!;
      entry.totalPaise += BigInt(p.totalAmountPaise);
      entry.count++;
    }
    const dailyBreakdown = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, totalPaise: v.totalPaise, count: v.count }));

    return this.serialize({
      year,
      month,
      totalCollectedPaise,
      interestCollectedPaise,
      principalCollectedPaise,
      paymentCount: payments.length,
      dailyBreakdown,
    });
  }

  // ---------------------------------------------------------------
  // getOutstanding()
  // ---------------------------------------------------------------

  async getOutstanding() {
    const now = new Date();

    const loans = await this.prisma.loan.findMany({
      where: { status: { notIn: [LoanStatus.SETTLED, LoanStatus.CLOSED] } },
      include: {
        customer: {
          select: { id: true, fullName: true, mobileNumber: true },
        },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let totalPrincipalOutstandingPaise = 0n;
    let totalInterestOutstandingPaise = 0n;

    const enriched = loans.map((loan) => {
      const totalInterestPaid = loan.payments.reduce(
        (s: bigint, p: any) => s + BigInt(p.interestAmountPaise),
        0n,
      );
      const totalPrincipalPaid = loan.payments.reduce(
        (s: bigint, p: any) => s + BigInt(p.principalAmountPaise),
        0n,
      );
      const accrued = this.interestService.calculateAccruedInterest(
        BigInt(loan.principalPaise),
        loan.monthlyRateBps,
        loan.startDate,
        now,
      );
      const outstandingInterest =
        this.interestService.calculateOutstandingInterest(
          accrued,
          totalInterestPaid,
        );
      const outstandingPrincipal =
        this.interestService.calculateOutstandingPrincipal(
          BigInt(loan.principalPaise),
          totalPrincipalPaid,
        );
      const totalOutstanding = outstandingInterest + outstandingPrincipal;
      const isOverdue = loan.dueDate < now;
      const effectiveStatus = isOverdue ? "OVERDUE" : loan.status;

      totalPrincipalOutstandingPaise += outstandingPrincipal;
      totalInterestOutstandingPaise += outstandingInterest;

      return {
        id: loan.id,
        loanNumber: loan.loanNumber,
        customer: loan.customer,
        principalPaise: loan.principalPaise,
        dueDate: loan.dueDate,
        effectiveStatus,
        outstandingPrincipalPaise: outstandingPrincipal,
        outstandingInterestPaise: outstandingInterest,
        totalOutstandingPaise: totalOutstanding,
      };
    });

    return this.serialize({
      asOfDate: now,
      activeLoanCount: loans.length,
      totalPrincipalOutstandingPaise,
      totalInterestOutstandingPaise,
      totalOutstandingPaise:
        totalPrincipalOutstandingPaise + totalInterestOutstandingPaise,
      loans: enriched,
    });
  }

  // ---------------------------------------------------------------
  // getOverdue()
  // ---------------------------------------------------------------

  async getOverdue() {
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;

    const loans = await this.prisma.loan.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: [LoanStatus.SETTLED, LoanStatus.CLOSED] },
      },
      include: {
        customer: {
          select: { id: true, fullName: true, mobileNumber: true },
        },
        payments: true,
      },
      orderBy: { dueDate: "asc" },
    });

    const enriched = loans.map((loan) => {
      const totalInterestPaid = loan.payments.reduce(
        (s: bigint, p: any) => s + BigInt(p.interestAmountPaise),
        0n,
      );
      const totalPrincipalPaid = loan.payments.reduce(
        (s: bigint, p: any) => s + BigInt(p.principalAmountPaise),
        0n,
      );
      const accrued = this.interestService.calculateAccruedInterest(
        BigInt(loan.principalPaise),
        loan.monthlyRateBps,
        loan.startDate,
        now,
      );
      const outstandingInterest =
        this.interestService.calculateOutstandingInterest(
          accrued,
          totalInterestPaid,
        );
      const outstandingPrincipal =
        this.interestService.calculateOutstandingPrincipal(
          BigInt(loan.principalPaise),
          totalPrincipalPaid,
        );
      const daysOverdue = Math.floor(
        (now.getTime() - loan.dueDate.getTime()) / msPerDay,
      );

      return {
        id: loan.id,
        loanNumber: loan.loanNumber,
        customer: loan.customer,
        principalPaise: loan.principalPaise,
        dueDate: loan.dueDate,
        daysOverdue,
        outstandingPrincipalPaise: outstandingPrincipal,
        outstandingInterestPaise: outstandingInterest,
        totalOutstandingPaise: outstandingInterest + outstandingPrincipal,
      };
    });

    return this.serialize(enriched);
  }

  // ---------------------------------------------------------------
  // getInterestIncome()
  // ---------------------------------------------------------------

  async getInterestIncome(fromDate: string, toDate: string) {
    const from = new Date(fromDate);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setUTCDate(to.getUTCDate() + 1);
    to.setUTCHours(0, 0, 0, 0);

    const payments = await this.prisma.payment.findMany({
      where: { paymentDate: { gte: from, lt: to } },
    });

    const totalInterestCollectedPaise = payments.reduce(
      (s: bigint, p: any) => s + BigInt(p.interestAmountPaise),
      0n,
    );

    return this.serialize({
      fromDate,
      toDate,
      totalInterestCollectedPaise,
      paymentCount: payments.length,
    });
  }

  // ---------------------------------------------------------------
  // getLoanSummary()
  // ---------------------------------------------------------------

  async getLoanSummary() {
    const now = new Date();

    const [
      totalLoansEver,
      activeAndOverdueLoans,
      settledCount,
      closedCount,
      aggregate,
    ] = await Promise.all([
      this.prisma.loan.count(),
      this.prisma.loan.findMany({
        where: {
          status: { notIn: [LoanStatus.SETTLED, LoanStatus.CLOSED] },
        },
        include: { payments: true },
      }),
      this.prisma.loan.count({ where: { status: LoanStatus.SETTLED } }),
      this.prisma.loan.count({ where: { status: LoanStatus.CLOSED } }),
      this.prisma.loan.aggregate({ _sum: { principalPaise: true } }),
    ]);

    const overdueCount = activeAndOverdueLoans.filter(
      (l) => l.dueDate < now,
    ).length;
    const activeCount = activeAndOverdueLoans.filter(
      (l) => l.dueDate >= now,
    ).length;

    let totalCurrentOutstandingPaise = 0n;
    for (const loan of activeAndOverdueLoans) {
      const totalInterestPaid = loan.payments.reduce(
        (s: bigint, p: any) => s + BigInt(p.interestAmountPaise),
        0n,
      );
      const totalPrincipalPaid = loan.payments.reduce(
        (s: bigint, p: any) => s + BigInt(p.principalAmountPaise),
        0n,
      );
      const accrued = this.interestService.calculateAccruedInterest(
        BigInt(loan.principalPaise),
        loan.monthlyRateBps,
        loan.startDate,
        now,
      );
      const outstandingInterest =
        this.interestService.calculateOutstandingInterest(
          accrued,
          totalInterestPaid,
        );
      const outstandingPrincipal =
        this.interestService.calculateOutstandingPrincipal(
          BigInt(loan.principalPaise),
          totalPrincipalPaid,
        );
      totalCurrentOutstandingPaise +=
        outstandingInterest + outstandingPrincipal;
    }

    const rawSum = aggregate._sum.principalPaise;
    const totalPrincipalDisbursedPaise = rawSum !== null ? BigInt(rawSum) : 0n;

    return this.serialize({
      totalLoansEver,
      activeLoans: activeCount,
      overdueLoans: overdueCount,
      settledLoans: settledCount,
      closedLoans: closedCount,
      totalPrincipalDisbursedPaise,
      totalCurrentOutstandingPaise,
    });
  }

  // ---------------------------------------------------------------
  // getCustomerLedger()
  // ---------------------------------------------------------------

  async getCustomerLedger(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        loans: {
          include: {
            payments: {
              include: {
                receipt: { select: { id: true, receiptNumber: true } },
              },
              orderBy: { paymentDate: "asc" },
            },
            goldItems: {
              select: {
                id: true,
                description: true,
                weightGrams: true,
                purity: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!customer) throw new NotFoundException("Customer not found");

    return this.serialize({
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        mobileNumber: customer.mobileNumber,
        address: customer.address,
        isActive: customer.isActive,
      },
      loans: customer.loans.map((loan) => ({
        id: loan.id,
        loanNumber: loan.loanNumber,
        principalPaise: loan.principalPaise,
        monthlyRateBps: loan.monthlyRateBps,
        interestType: loan.interestType,
        startDate: loan.startDate,
        dueDate: loan.dueDate,
        tenureMonths: loan.tenureMonths,
        status: loan.status,
        settledAt: loan.settledAt,
        goldItems: loan.goldItems,
        payments: loan.payments,
      })),
    });
  }

  // ---------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------

  private serialize(obj: any): any {
    if (!obj) return obj;
    return JSON.parse(
      JSON.stringify(obj, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }
}
