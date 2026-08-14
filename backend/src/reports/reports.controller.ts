import { Controller, Get, Param, Query } from "@nestjs/common";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { DailyCollectionQueryDto } from "./dto/daily-collection-query.dto";
import { InterestIncomeQueryDto } from "./dto/interest-income-query.dto";
import { MonthlyCollectionQueryDto } from "./dto/monthly-collection-query.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
@RequirePermissions(Permission.VIEW_REPORTS)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("daily-collection")
  getDailyCollection(@Query() query: DailyCollectionQueryDto) {
    return this.reportsService.getDailyCollection(query.date);
  }

  @Get("monthly-collection")
  getMonthlyCollection(@Query() query: MonthlyCollectionQueryDto) {
    return this.reportsService.getMonthlyCollection(query.year, query.month);
  }

  @Get("outstanding")
  getOutstanding() {
    return this.reportsService.getOutstanding();
  }

  @Get("overdue")
  getOverdue() {
    return this.reportsService.getOverdue();
  }

  @Get("interest-income")
  getInterestIncome(@Query() query: InterestIncomeQueryDto) {
    return this.reportsService.getInterestIncome(query.fromDate, query.toDate);
  }

  @Get("loan-summary")
  getLoanSummary() {
    return this.reportsService.getLoanSummary();
  }

  @Get("customer-ledger/:customerId")
  getCustomerLedger(@Param("customerId") customerId: string) {
    return this.reportsService.getCustomerLedger(customerId);
  }
}
