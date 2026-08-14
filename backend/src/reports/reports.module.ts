import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { LoansModule } from "../loans/loans.module";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [PrismaModule, LoansModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
