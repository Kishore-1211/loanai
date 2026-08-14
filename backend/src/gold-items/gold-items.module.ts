import { Module } from "@nestjs/common";
import { GoldItemsController } from "./gold-items.controller";
import { GoldItemsService } from "./gold-items.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [GoldItemsController],
  providers: [GoldItemsService],
  exports: [GoldItemsService],
})
export class GoldItemsModule {}
