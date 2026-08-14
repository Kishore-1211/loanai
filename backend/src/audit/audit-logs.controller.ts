import { Controller, Get, Query } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";
import { OwnerOnly } from "../common/decorators/owner-only.decorator";

@Controller("audit-logs")
@OwnerOnly()
export class AuditLogsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditService.findAll(query);
  }
}
