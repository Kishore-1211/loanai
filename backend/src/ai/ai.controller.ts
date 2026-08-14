import { Controller, Post, Body, HttpCode } from "@nestjs/common";
import { Permission } from "@prisma/client";
import { AiService } from "./ai.service";
import { AiQueryDto } from "./dto/ai-query.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../common/types/jwt-payload.type";

@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("query")
  @HttpCode(200)
  @RequirePermissions(Permission.USE_AI_ASSISTANT)
  query(@CurrentUser() user: JwtPayload, @Body() dto: AiQueryDto) {
    return this.aiService.query(user, dto);
  }
}
