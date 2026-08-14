import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { LoansService } from "./loans.service";
import { CreateLoanDto } from "./dto/create-loan.dto";
import { LoanQueryDto } from "./dto/loan-query.dto";

@Controller("loans")
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  // CRITICAL: literal routes BEFORE :id param to avoid route conflicts

  @Get("overdue")
  @RequirePermissions(Permission.VIEW_OVERDUE_LOANS)
  findOverdue() {
    return this.loansService.findOverdue();
  }

  @Get("due-soon")
  @RequirePermissions(Permission.VIEW_OVERDUE_LOANS)
  findDueSoon() {
    return this.loansService.findDueSoon();
  }

  @Get()
  @RequirePermissions(Permission.VIEW_ALL_LOANS)
  findAll(@CurrentUser() user: JwtPayload, @Query() query: LoanQueryDto) {
    return this.loansService.findAll(user, query);
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions(Permission.CREATE_LOAN)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLoanDto) {
    return this.loansService.create(user, dto);
  }

  @Get(":id")
  findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.loansService.findOne(user, id);
  }
}
