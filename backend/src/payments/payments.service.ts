import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  AuditEventType,
  GoldItemStatus,
  LoanStatus,
  PaymentMethod,
  PaymentType,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { InterestService } from "../loans/interest.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { RecordPaymentDto } from "./dto/record-payment.dto";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly interestService: InterestService,
  ) {}

  // ---------------------------------------------------------------
  // recordPayment()
  // ---------------------------------------------------------------

  async recordPayment(user: JwtPayload, dto: RecordPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch loan
      const loan = await tx.loan.findUnique({ where: { id: dto.loanId } });
      if (!loan) {
        throw new NotFoundException("Loan not found");
      }

      // 2. Check loan status — cannot record on settled or closed
      const storedStatus = loan.status;
      const effectiveStatus = this.interestService.getEffectiveStatus(loan);
      if (
        storedStatus === LoanStatus.SETTLED ||
        storedStatus === LoanStatus.CLOSED
      ) {
        throw new UnprocessableEntityException(
          "Cannot record payment on a settled or closed loan",
        );
      }

      // 3. Validate amount (service-layer guard in addition to DTO @Min)
      const totalAmountPaise = BigInt(dto.totalAmountPaise);
      if (totalAmountPaise < BigInt(1)) {
        throw new BadRequestException(
          "Payment amount must be at least 1 paise",
        );
      }

      // 4. Fetch all prior payments for this loan
      const priorPayments = await tx.payment.findMany({
        where: { loanId: dto.loanId },
      });

      const totalInterestPaid = priorPayments.reduce(
        (sum: bigint, p: any) => sum + BigInt(p.interestAmountPaise),
        BigInt(0),
      );
      const totalPrincipalPaid = priorPayments.reduce(
        (sum: bigint, p: any) => sum + BigInt(p.principalAmountPaise),
        BigInt(0),
      );

      // 5. Calculate accrued interest as of payment date
      const accruedInterest = this.interestService.calculateAccruedInterest(
        BigInt(loan.principalPaise),
        loan.monthlyRateBps,
        loan.startDate,
        new Date(dto.paymentDate),
      );

      // 6. Calculate outstanding
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

      // 7. Allocate — interest first (BR-FIN-001)
      const interestAmountPaise =
        totalAmountPaise < outstandingInterest
          ? totalAmountPaise
          : outstandingInterest;
      const remaining = totalAmountPaise - interestAmountPaise;
      const principalAmountPaise =
        remaining < outstandingPrincipal ? remaining : outstandingPrincipal;
      const actualTotalPaise = interestAmountPaise + principalAmountPaise;

      // 8. Determine paymentType
      const isFullySettled =
        interestAmountPaise >= outstandingInterest &&
        principalAmountPaise >= outstandingPrincipal;

      let paymentType: PaymentType;
      if (isFullySettled) {
        paymentType = PaymentType.FULL_SETTLEMENT;
      } else if (principalAmountPaise === BigInt(0)) {
        paymentType = PaymentType.INTEREST_ONLY;
      } else {
        paymentType = PaymentType.PRINCIPAL_AND_INTEREST;
      }

      // 9. Create payment record
      const payment = await tx.payment.create({
        data: {
          loanId: dto.loanId,
          recordedById: user.sub,
          paymentDate: new Date(dto.paymentDate),
          totalAmountPaise: actualTotalPaise,
          interestAmountPaise,
          principalAmountPaise,
          paymentMethod: dto.paymentMethod as PaymentMethod,
          paymentType,
          referenceNumber: dto.referenceNumber ?? null,
          notes: dto.notes ?? null,
        },
      });

      // 10. If fully settled — update loan and release gold items
      if (isFullySettled) {
        await tx.loan.update({
          where: { id: dto.loanId },
          data: { status: LoanStatus.SETTLED, settledAt: new Date() },
        });
        await tx.goldItem.updateMany({
          where: { loanId: dto.loanId },
          data: { status: GoldItemStatus.RELEASED },
        });
      }

      // 11. Audit log
      await this.auditService.log(
        {
          eventType: AuditEventType.PAYMENT_RECORDED,
          performedById: user.sub,
          performedByName: user.email,
          affectedModel: "Payment",
          affectedId: payment.id,
          afterValue: {
            loanId: dto.loanId,
            totalAmountPaise: actualTotalPaise.toString(),
            interestAmountPaise: interestAmountPaise.toString(),
            principalAmountPaise: principalAmountPaise.toString(),
            paymentMethod: dto.paymentMethod,
            paymentType,
            loanSettled: isFullySettled,
          },
        },
        tx,
      );

      // 12. Compute outstanding after payment
      const newOutstandingInterest = outstandingInterest - interestAmountPaise;
      const newOutstandingPrincipal =
        outstandingPrincipal - principalAmountPaise;
      const outstandingAfterPaise =
        (newOutstandingInterest < BigInt(0)
          ? BigInt(0)
          : newOutstandingInterest) +
        (newOutstandingPrincipal < BigInt(0)
          ? BigInt(0)
          : newOutstandingPrincipal);

      // 13. Return serialized
      return this.serialize({
        ...payment,
        loanStatusAfter: isFullySettled ? LoanStatus.SETTLED : effectiveStatus,
        outstandingAfterPaise,
      });
    });
  }

  // ---------------------------------------------------------------
  // findOne()
  // ---------------------------------------------------------------

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        recordedBy: { select: { id: true, fullName: true } },
        receipt: { select: { id: true, receiptNumber: true } },
        loan: { select: { id: true, loanNumber: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    return this.serialize(payment);
  }

  // ---------------------------------------------------------------
  // findByLoanId()
  // ---------------------------------------------------------------

  async findByLoanId(loanId: string) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) {
      throw new NotFoundException("Loan not found");
    }

    const payments = await this.prisma.payment.findMany({
      where: { loanId },
      orderBy: { paymentDate: "asc" },
      include: {
        recordedBy: { select: { id: true, fullName: true } },
        receipt: { select: { id: true, receiptNumber: true } },
      },
    });

    return this.serialize(payments);
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
