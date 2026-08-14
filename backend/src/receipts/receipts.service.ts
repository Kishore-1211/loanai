import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditEventType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { InterestService } from "../loans/interest.service";
import { JwtPayload } from "../common/types/jwt-payload.type";

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly interestService: InterestService,
  ) {}

  // ---------------------------------------------------------------
  // generate()
  // ---------------------------------------------------------------

  async generate(user: JwtPayload, paymentId: string) {
    // 1. Fetch payment with all needed relations
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        loan: { include: { customer: true } },
        recordedBy: { select: { id: true, fullName: true } },
        receipt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    // 2. Check for existing receipt (idempotency guard)
    if (payment.receipt) {
      throw new ConflictException(
        "A receipt has already been generated for this payment",
      );
    }

    // 3. Fetch BusinessSettings — use fallback if not yet configured
    const settings = await this.prisma.businessSettings.findUnique({
      where: { id: "singleton" },
    });

    const businessName = settings?.businessName ?? "Gold Loan Business";
    const businessAddress = settings?.businessAddress ?? "";
    const footerText = settings?.receiptFooterText ?? null;

    // 4. Compute outstandingAfterPaise
    //    Sum ALL payments for this loan (including the current one, which already exists in DB)
    const allPayments = await this.prisma.payment.findMany({
      where: { loanId: payment.loan.id },
    });

    const totalInterestPaid = allPayments.reduce(
      (sum: bigint, p: any) => sum + BigInt(p.interestAmountPaise),
      BigInt(0),
    );
    const totalPrincipalPaid = allPayments.reduce(
      (sum: bigint, p: any) => sum + BigInt(p.principalAmountPaise),
      BigInt(0),
    );

    const accrued = this.interestService.calculateAccruedInterest(
      BigInt(payment.loan.principalPaise),
      payment.loan.monthlyRateBps,
      payment.loan.startDate,
      payment.paymentDate,
    );

    const outstandingInterest =
      this.interestService.calculateOutstandingInterest(
        accrued,
        totalInterestPaid,
      );
    const outstandingPrincipal =
      this.interestService.calculateOutstandingPrincipal(
        BigInt(payment.loan.principalPaise),
        totalPrincipalPaid,
      );

    const outstandingAfterPaise = outstandingInterest + outstandingPrincipal;

    // 5. Run everything inside a transaction to prevent race conditions
    const receipt = await this.prisma.$transaction(async (tx) => {
      // a. Generate receipt number (inside tx to prevent races)
      const lastReceipt = await tx.receipt.findFirst({
        orderBy: { receiptNumber: "desc" },
      });
      const nextNum = lastReceipt
        ? parseInt(lastReceipt.receiptNumber.replace("REC-", ""), 10) + 1
        : 10001;
      const receiptNumber = `REC-${nextNum}`;

      // b. Create receipt (point-in-time snapshot)
      const created = await tx.receipt.create({
        data: {
          receiptNumber,
          paymentId: payment.id,
          businessName,
          businessAddress,
          customerName: payment.loan.customer.fullName,
          customerMobile: payment.loan.customer.mobileNumber,
          loanNumber: payment.loan.loanNumber,
          paymentDate: payment.paymentDate,
          amountPaidPaise: payment.totalAmountPaise,
          paymentMethod: payment.paymentMethod,
          outstandingAfterPaise,
          recordedByName: payment.recordedBy.fullName,
          footerText,
        },
      });

      // c. Audit log — RECEIPT_GENERATED
      await this.auditService.log(
        {
          eventType: AuditEventType.RECEIPT_GENERATED,
          performedById: user.sub,
          performedByName: user.email,
          affectedModel: "Receipt",
          affectedId: created.id,
          afterValue: {
            receiptNumber,
            paymentId: payment.id,
            loanNumber: payment.loan.loanNumber,
          },
        },
        tx,
      );

      return created;
    });

    // 6. Return serialized (BigInt → string)
    return this.serialize(receipt);
  }

  // ---------------------------------------------------------------
  // findOne()
  // ---------------------------------------------------------------

  async findOne(id: string) {
    const receipt = await this.prisma.receipt.findUnique({ where: { id } });

    if (!receipt) {
      throw new NotFoundException("Receipt not found");
    }

    return this.serialize(receipt);
  }

  // ---------------------------------------------------------------
  // findByPaymentId()
  // ---------------------------------------------------------------

  async findByPaymentId(paymentId: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { paymentId },
    });

    if (!receipt) {
      throw new NotFoundException("No receipt found for this payment");
    }

    return this.serialize(receipt);
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
