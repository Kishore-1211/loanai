import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { LoansModule } from "../loans/loans.module";
import { ReceiptsService } from "./receipts.service";
import { ReceiptsController } from "./receipts.controller";

@Module({
  imports: [PrismaModule, AuditModule, LoansModule],
  providers: [ReceiptsService],
  controllers: [ReceiptsController],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
