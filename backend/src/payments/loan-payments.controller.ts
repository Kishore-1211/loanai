import { Controller, Get, Param } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

@Controller("loans")
export class LoanPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(":loanId/payments")
  findByLoanId(@Param("loanId") loanId: string) {
    return this.paymentsService.findByLoanId(loanId);
  }
}
