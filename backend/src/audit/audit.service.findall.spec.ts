import { Test, TestingModule } from "@nestjs/testing";
import { AuditService } from "./audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";
import { AuditEventType } from "@prisma/client";

describe("AuditService.findAll()", () => {
  let service: AuditService;
  let prisma: {
    auditLog: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns paginated data with meta (total, page, pageSize, totalPages)", async () => {
    const fakeLogs = [{ id: "log-1" }, { id: "log-2" }];
    prisma.auditLog.findMany.mockResolvedValue(fakeLogs);
    prisma.auditLog.count.mockResolvedValue(42);

    const query: AuditLogQueryDto = { page: 2, pageSize: 10 };
    const result = await service.findAll(query);

    expect(result.data).toEqual(fakeLogs);
    expect(result.meta).toEqual({
      total: 42,
      page: 2,
      pageSize: 10,
      totalPages: 5,
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it("filters by eventType when provided", async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    const query: AuditLogQueryDto = { eventType: AuditEventType.LOAN_CREATED };
    await service.findAll(query);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventType: AuditEventType.LOAN_CREATED,
        }),
      }),
    );
  });

  it("filters by fromDate (gte) and toDate (lt next day) when provided", async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    const query: AuditLogQueryDto = {
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
    };
    await service.findAll(query);

    const callArgs = prisma.auditLog.findMany.mock.calls[0][0];
    const createdAt = callArgs.where.createdAt;

    expect(createdAt).toBeDefined();
    expect(createdAt.gte).toBeInstanceOf(Date);
    expect(createdAt.lt).toBeInstanceOf(Date);

    // fromDate start of day UTC
    expect(createdAt.gte.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    // toDate + 1 day start of day UTC
    expect(createdAt.lt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("filters by affectedId when provided", async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    const affectedId = "some-uuid-1234";
    const query: AuditLogQueryDto = { affectedId };
    await service.findAll(query);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ affectedId }),
      }),
    );
  });

  it("respects page and pageSize for skip/take", async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    const query: AuditLogQueryDto = { page: 3, pageSize: 15 };
    await service.findAll(query);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 30, take: 15 }),
    );
  });

  it("returns empty data array and total=0 when no logs match", async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    const query: AuditLogQueryDto = {};
    const result = await service.findAll(query);

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(result.meta.totalPages).toBe(0);
  });
});
