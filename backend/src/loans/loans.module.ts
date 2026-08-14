import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { InterestService } from "./interest.service";
import { LoansService } from "./loans.service";
import { LoansController } from "./loans.controller";

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [InterestService, LoansService],
  controllers: [LoansController],
  exports: [LoansService, InterestService], // PaymentsModule will need both
})
export class LoansModule {}
