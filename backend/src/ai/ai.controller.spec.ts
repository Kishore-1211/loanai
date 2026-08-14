import { Test, TestingModule } from "@nestjs/testing";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

describe("AiController", () => {
  let controller: AiController;
  let aiService: jest.Mocked<AiService>;

  const mockAiService = {
    query: jest.fn(),
  };

  const mockUser = {
    sub: "user-123",
    email: "owner@example.com",
    role: "OWNER" as any,
    permissions: ["USE_AI_ASSISTANT"] as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: AiService,
          useValue: mockAiService,
        },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
    aiService = module.get(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: AiController is defined
  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  // Test 2: query delegates to aiService.query with currentUser and dto
  it("should delegate query to aiService.query with currentUser and dto", async () => {
    const dto = { query: "show overdue loans" };
    const expectedResult = {
      answer: "There are 2 overdue loans.",
      toolsUsed: ["get_overdue_loans"],
      dataRetrievedAt: new Date().toISOString(),
    };

    mockAiService.query.mockResolvedValueOnce(expectedResult);

    const result = await controller.query(mockUser, dto);

    expect(aiService.query).toHaveBeenCalledWith(mockUser, dto);
    expect(result).toEqual(expectedResult);
  });
});
