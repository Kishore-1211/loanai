import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogsController } from "./audit-logs.controller";
import { AuditService } from "./audit.service";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";

describe("AuditLogsController", () => {
  let controller: AuditLogsController;
  let auditService: jest.Mocked<Pick<AuditService, "findAll">>;

  const mockAuditService = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    controller = module.get<AuditLogsController>(AuditLogsController);
    auditService = module.get(AuditService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("findAll should delegate to auditService.findAll with the query object", async () => {
    const query: AuditLogQueryDto = { page: 1, pageSize: 10 };
    const expectedResult = {
      data: [],
      meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
    };

    mockAuditService.findAll.mockResolvedValue(expectedResult);

    const result = await controller.findAll(query);

    expect(auditService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual(expectedResult);
  });
});
