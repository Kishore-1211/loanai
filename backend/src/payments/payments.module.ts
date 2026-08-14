import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { LoansModule } from "../loans/loans.module";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { LoanPaymentsController } from "./loan-payments.controller";

@Module({
  imports: [PrismaModule, AuditModule, LoansModule],
  providers: [PaymentsService],
  controllers: [PaymentsController, LoanPaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
