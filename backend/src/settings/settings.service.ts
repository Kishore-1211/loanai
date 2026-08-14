import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditEventType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getSettings() {
    const settings = await this.prisma.businessSettings.findUnique({
      where: { id: "singleton" },
    });
    if (!settings) {
      throw new NotFoundException("Business settings not found");
    }
    return settings;
  }

  async updateSettings(user: JwtPayload, dto: UpdateSettingsDto) {
    // Fetch existing first for audit before-value
    const existing = await this.prisma.businessSettings.findUnique({
      where: { id: "singleton" },
    });
    if (!existing) {
      throw new NotFoundException("Business settings not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.businessSettings.update({
        where: { id: "singleton" },
        data: dto, // Prisma ignores undefined fields in update
      });

      await this.auditService.log(
        {
          eventType: AuditEventType.SETTINGS_CHANGED,
          performedById: user.sub,
          performedByName: user.email,
          affectedModel: "BusinessSettings",
          affectedId: "singleton",
          beforeValue: {
            businessName: existing.businessName,
            businessAddress: existing.businessAddress,
            businessPhone: existing.businessPhone,
            defaultMonthlyRateBps: existing.defaultMonthlyRateBps,
            defaultInterestType: existing.defaultInterestType,
            defaultTenureMonths: existing.defaultTenureMonths,
            currencySymbol: existing.currencySymbol,
            receiptFooterText: existing.receiptFooterText,
          },
          afterValue: dto,
        },
        tx,
      );

      return updated;
    });
  }
}
