import { Injectable } from "@nestjs/common";
import { AuditEventType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";

export interface AuditLogInput {
  eventType: AuditEventType;
  performedById: string;
  performedByName: string;
  affectedModel: string;
  affectedId: string;
  beforeValue?: object;
  afterValue?: object;
  metadata?: object;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry.
   * Accepts an optional `tx` parameter to run within an existing Prisma transaction.
   */
  async log(input: AuditLogInput, tx?: any): Promise<void> {
    const client = tx || this.prisma;

    await client.auditLog.create({
      data: {
        eventType: input.eventType,
        performedById: input.performedById,
        performedByName: input.performedByName,
        affectedModel: input.affectedModel,
        affectedId: input.affectedId,
        beforeValue: input.beforeValue ? (input.beforeValue as any) : undefined,
        afterValue: input.afterValue ? (input.afterValue as any) : undefined,
        metadata: input.metadata ? (input.metadata as any) : undefined,
      },
    });
  }

  async findAll(query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {};

    if (query.eventType) where.eventType = query.eventType;
    if (query.performedById) where.performedById = query.performedById;
    if (query.affectedId) where.affectedId = query.affectedId;
    if (query.affectedModel)
      where.affectedModel = {
        contains: query.affectedModel,
        mode: "insensitive",
      };

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) {
        const from = new Date(query.fromDate);
        from.setUTCHours(0, 0, 0, 0);
        (where.createdAt as any).gte = from;
      }
      if (query.toDate) {
        const to = new Date(query.toDate);
        to.setUTCDate(to.getUTCDate() + 1);
        to.setUTCHours(0, 0, 0, 0);
        (where.createdAt as any).lt = to;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
