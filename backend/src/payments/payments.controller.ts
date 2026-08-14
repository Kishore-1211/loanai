import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { Permission } from "@prisma/client";
import { PaymentsService } from "./payments.service";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../common/types/jwt-payload.type";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions(Permission.RECORD_PAYMENT)
  recordPayment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.paymentsService.recordPayment(user, dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.paymentsService.findOne(id);
  }
}
