import { Controller, Get, Patch, Body } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { OwnerOnly } from "../common/decorators/owner-only.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../common/types/jwt-payload.type";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @OwnerOnly()
  updateSettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(user, dto);
  }
}
