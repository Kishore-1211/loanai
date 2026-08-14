import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
