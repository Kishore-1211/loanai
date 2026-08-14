import { Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { Permission } from "@prisma/client";
import { ReceiptsService } from "./receipts.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../common/types/jwt-payload.type";

@Controller("receipts")
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  // POST /receipts/:paymentId — generate receipt for a payment
  @Post(":paymentId")
  @HttpCode(201)
  @RequirePermissions(Permission.RECORD_PAYMENT)
  generate(
    @CurrentUser() user: JwtPayload,
    @Param("paymentId") paymentId: string,
  ) {
    return this.receiptsService.generate(user, paymentId);
  }

  // GET /receipts/:id — get receipt by id
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.receiptsService.findOne(id);
  }
}
