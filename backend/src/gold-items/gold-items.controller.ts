import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  NotImplementedException,
} from "@nestjs/common";
import { Permission } from "@prisma/client";
import { GoldItemsService } from "./gold-items.service";
import { CreateGoldItemDto } from "./dto/create-gold-item.dto";
import { UpdateGoldItemDto } from "./dto/update-gold-item.dto";
import { RequireAnyPermission } from "../common/decorators/require-any-permission.decorator";
import { OwnerOnly } from "../common/decorators/owner-only.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../common/types/jwt-payload.type";

@Controller("gold-items")
export class GoldItemsController {
  constructor(private readonly goldItemsService: GoldItemsService) {}

  /**
   * POST /gold-items — requires CREATE_CUSTOMER OR CREATE_LOAN permission
   */
  @Post()
  @HttpCode(201)
  @RequireAnyPermission(Permission.CREATE_CUSTOMER, Permission.CREATE_LOAN)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateGoldItemDto) {
    return this.goldItemsService.create(user, dto);
  }

  /**
   * GET /gold-items/:id — any authenticated user
   */
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.goldItemsService.findOne(id);
  }

  /**
   * PATCH /gold-items/:id — OWNER only; updates description and conditionNotes
   */
  @Patch(":id")
  @OwnerOnly()
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateGoldItemDto,
  ) {
    return this.goldItemsService.update(user, id, dto);
  }

  /**
   * POST /gold-items/:id/photo — stub (501)
   * File upload pending Supabase storage integration.
   */
  @Post(":id/photo")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  uploadPhoto(@Param("id") _id: string) {
    throw new NotImplementedException(
      "File upload not yet implemented. Supabase storage integration pending.",
    );
  }
}
