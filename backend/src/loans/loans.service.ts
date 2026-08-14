import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AuditEventType, LoanStatus, Permission } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { InterestService } from "./interest.service";
import { CreateLoanDto } from "./dto/create-loan.dto";
import { LoanQueryDto } from "./dto/loan-query.dto";

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly interestService: InterestService,
  ) {}

  // ---------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------

  /**
   * Serialize all BigInt values in an object to strings for JSON safety.
   */
  private serialize(obj: any): any {
    if (!obj) return obj;
    return JSON.parse(
      JSON.stringify(obj, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }

  /**
   * Compute outstanding amounts for a loan as of now.
   * Accepts an optional transaction client.
   */
  private async computeLoanOutstanding(
    loan: any,
    tx?: any,
  ): Promise<{
    accruedInterestPaise: bigint;
    totalInterestPaidPaise: bigint;
    totalPrincipalPaidPaise: bigint;
    outstandingInterestPaise: bigint;
    outstandingPrincipalPaise: bigint;
    totalOutstandingPaise: bigint;
  }> {
    const client = tx || this.prisma;
    const payments = await client.payment.findMany({
      where: { loanId: loan.id },
    });

    const totalInterestPaid = payments.reduce(
      (sum: bigint, p: any) => sum + BigInt(p.interestAmountPaise),
      BigInt(0),
    );
    const totalPrincipalPaid = payments.reduce(
      (sum: bigint, p: any) => sum + BigInt(p.principalAmountPaise),
      BigInt(0),
    );

    const accruedInterest = this.interestService.calculateAccruedInterest(
      BigInt(loan.principalPaise),
      loan.monthlyRateBps,
      loan.startDate,
      new Date(),
    );

    const outstandingInterest =
      this.interestService.calculateOutstandingInterest(
        accruedInterest,
        totalInterestPaid,
      );
    const outstandingPrincipal =
      this.interestService.calculateOutstandingPrincipal(
        BigInt(loan.principalPaise),
        totalPrincipalPaid,
      );

    return {
      accruedInterestPaise: accruedInterest,
      totalInterestPaidPaise: totalInterestPaid,
      totalPrincipalPaidPaise: totalPrincipalPaid,
      outstandingInterestPaise: outstandingInterest,
      outstandingPrincipalPaise: outstandingPrincipal,
      totalOutstandingPaise: this.interestService.calculateTotalOutstanding(
        outstandingPrincipal,
        outstandingInterest,
      ),
    };
  }

  // ---------------------------------------------------------------
  // create()
  // ---------------------------------------------------------------

  async create(user: JwtPayload, dto: CreateLoanDto) {
    // 1. Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    // 2. Verify customer is active
    if (!customer.isActive) {
      throw new UnprocessableEntityException("Customer account is inactive");
    }

    // 3. Verify each gold item
    for (const goldItemId of dto.goldItemIds) {
      const goldItem = await this.prisma.goldItem.findUnique({
        where: { id: goldItemId },
        include: { loan: true },
      });

      if (!goldItem) {
        throw new NotFoundException(`Gold item ${goldItemId} not found`);
      }

      if (goldItem.customerId !== dto.customerId) {
        throw new NotFoundException(
          `Gold item ${goldItemId} does not belong to this customer`,
        );
      }

      // Check if item is pledged to an active/overdue loan
      if (goldItem.loanId !== null && goldItem.loan) {
        const linked = goldItem.loan;
        if (
          linked.status !== LoanStatus.SETTLED &&
          linked.status !== LoanStatus.CLOSED
        ) {
          throw new ConflictException(
            `Gold item ${goldItemId} is already pledged to an active loan`,
          );
        }
      }
    }

    // 4. Create loan inside transaction
    const loan = await this.prisma.$transaction(async (tx) => {
      // Generate loan number
      const lastLoan = await tx.loan.findFirst({
        orderBy: { loanNumber: "desc" },
      });
      const nextNum = lastLoan
        ? parseInt(lastLoan.loanNumber.replace("GL-", ""), 10) + 1
        : 1001;
      const loanNumber = `GL-${nextNum}`;

      const startDate = new Date(dto.startDate);
      const dueDate = this.interestService.calculateDueDate(
        startDate,
        dto.tenureMonths,
      );

      const createdLoan = await tx.loan.create({
        data: {
          loanNumber,
          customerId: dto.customerId,
          createdById: user.sub,
          principalPaise: BigInt(dto.principalPaise),
          monthlyRateBps: dto.monthlyRateBps,
          interestType: dto.interestType,
          startDate,
          dueDate,
          tenureMonths: dto.tenureMonths,
          status: LoanStatus.ACTIVE,
        },
      });

      // Link gold items to the new loan
      await tx.goldItem.updateMany({
        where: { id: { in: dto.goldItemIds } },
        data: { loanId: createdLoan.id },
      });

      // Audit log
      await this.auditService.log(
        {
          eventType: AuditEventType.LOAN_CREATED,
          performedById: user.sub,
          performedByName: user.email,
          affectedModel: "Loan",
          affectedId: createdLoan.id,
          afterValue: {
            loanNumber,
            principalPaise: dto.principalPaise,
            monthlyRateBps: dto.monthlyRateBps,
            tenureMonths: dto.tenureMonths,
            dueDate: dueDate.toISOString(),
            customerId: dto.customerId,
          },
        },
        tx,
      );

      return createdLoan;
    });

    // Outstanding amounts are all 0 at creation
    const outstanding = {
      accruedInterestPaise: BigInt(0),
      totalInterestPaidPaise: BigInt(0),
      totalPrincipalPaidPaise: BigInt(0),
      outstandingInterestPaise: BigInt(0),
      outstandingPrincipalPaise: BigInt(loan.principalPaise),
      totalOutstandingPaise: BigInt(loan.principalPaise),
    };

    const effectiveStatus = this.interestService.getEffectiveStatus(loan);

    return this.serialize({
      ...loan,
      ...outstanding,
      effectiveStatus,
    });
  }

  // ---------------------------------------------------------------
  // findAll()
  // ---------------------------------------------------------------

  async findAll(user: JwtPayload, query: LoanQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {};

    // Scope to own loans if STAFF without VIEW_ALL_LOANS
    const hasViewAll = user.permissions?.includes(Permission.VIEW_ALL_LOANS);
    if (!hasViewAll) {
      where.createdById = user.sub;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.status === "OVERDUE") {
      where.dueDate = { lt: new Date() };
      where.status = LoanStatus.ACTIVE;
    } else if (query.status === "ACTIVE") {
      where.status = LoanStatus.ACTIVE;
      where.dueDate = { gte: new Date() };
    } else if (query.status === "SETTLED") {
      where.status = LoanStatus.SETTLED;
    } else if (query.status === "CLOSED") {
      where.status = LoanStatus.CLOSED;
    }

    const [loans, total] = await Promise.all([
      this.prisma.loan.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: { id: true, fullName: true, mobileNumber: true },
          },
        },
      }),
      this.prisma.loan.count({ where }),
    ]);

    // Compute outstanding and effectiveStatus for each loan
    const enriched = await Promise.all(
      loans.map(async (loan) => {
        const outstanding = await this.computeLoanOutstanding(loan);
        const effectiveStatus = this.interestService.getEffectiveStatus(loan);
        return { ...loan, ...outstanding, effectiveStatus };
      }),
    );

    return this.serialize({
      data: enriched,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  }

  // ---------------------------------------------------------------
  // findOne()
  // ---------------------------------------------------------------

  async findOne(user: JwtPayload, id: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, fullName: true, mobileNumber: true },
        },
        goldItems: true,
        payments: {
          include: {
            receipt: { select: { id: true, receiptNumber: true } },
          },
          orderBy: { paymentDate: "asc" },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException("Loan not found");
    }

    // Ownership check for STAFF without VIEW_ALL_LOANS
    const hasViewAll = user.permissions?.includes(Permission.VIEW_ALL_LOANS);
    if (!hasViewAll && loan.createdById !== user.sub) {
      throw new ForbiddenException(
        "Insufficient permissions to view this loan",
      );
    }

    const outstanding = await this.computeLoanOutstanding(loan);
    const effectiveStatus = this.interestService.getEffectiveStatus(loan);

    return this.serialize({
      ...loan,
      ...outstanding,
      effectiveStatus,
      asOfDate: new Date(),
    });
  }

  // ---------------------------------------------------------------
  // findOverdue()
  // ---------------------------------------------------------------

  async findOverdue() {
    const now = new Date();

    const loans = await this.prisma.loan.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: [LoanStatus.SETTLED, LoanStatus.CLOSED] },
      },
      orderBy: { dueDate: "asc" },
      include: {
        customer: {
          select: { id: true, fullName: true, mobileNumber: true },
        },
      },
    });

    const msPerDay = 1000 * 60 * 60 * 24;

    const enriched = await Promise.all(
      loans.map(async (loan) => {
        const outstanding = await this.computeLoanOutstanding(loan);
        const daysOverdue = Math.floor(
          (now.getTime() - loan.dueDate.getTime()) / msPerDay,
        );
        return {
          ...loan,
          ...outstanding,
          effectiveStatus: LoanStatus.OVERDUE,
          daysOverdue,
        };
      }),
    );

    return this.serialize(enriched);
  }

  // ---------------------------------------------------------------
  // findDueSoon()
  // ---------------------------------------------------------------

  async findDueSoon() {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const loans = await this.prisma.loan.findMany({
      where: {
        dueDate: { gte: now, lte: sevenDaysFromNow },
        status: LoanStatus.ACTIVE,
      },
      orderBy: { dueDate: "asc" },
      include: {
        customer: {
          select: { id: true, fullName: true, mobileNumber: true },
        },
      },
    });

    const enriched = await Promise.all(
      loans.map(async (loan) => {
        const outstanding = await this.computeLoanOutstanding(loan);
        const effectiveStatus = this.interestService.getEffectiveStatus(loan);
        return { ...loan, ...outstanding, effectiveStatus };
      }),
    );

    return this.serialize(enriched);
  }
}
