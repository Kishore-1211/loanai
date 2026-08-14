import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { LoansModule } from "../loans/loans.module";
import { AuditModule } from "../audit/audit.module";
import { AiService } from "./ai.service";
import { AiController } from "./ai.controller";

@Module({
  imports: [PrismaModule, LoansModule, AuditModule],
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}
