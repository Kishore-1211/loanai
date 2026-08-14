import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AuditEventType } from "@prisma/client";
import { AiService } from "./ai.service";
import { PrismaService } from "../prisma/prisma.service";
import { InterestService } from "../loans/interest.service";
import { AuditService } from "../audit/audit.service";

const mockGroq = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
};

jest.mock("groq-sdk", () => {
  return {
    default: jest.fn().mockImplementation(() => mockGroq),
  };
});

describe("AiService", () => {
  let service: AiService;
  let prismaService: jest.Mocked<PrismaService>;
  let auditService: jest.Mocked<AuditService>;

  const mockUser = {
    sub: "user-123",
    email: "owner@example.com",
    role: "OWNER" as any,
    permissions: ["USE_AI_ASSISTANT"] as any,
  };

  beforeEach(async () => {
    process.env.GROQ_API_KEY = "test-key";

    mockGroq.chat.completions.create.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: PrismaService,
          useValue: {
            loan: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
            payment: {
              findMany: jest.fn(),
            },
            customer: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: InterestService,
          useValue: {
            calculateAccruedInterest: jest.fn().mockReturnValue(0n),
            calculateOutstandingInterest: jest.fn().mockReturnValue(0n),
            calculateOutstandingPrincipal: jest.fn().mockReturnValue(0n),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    prismaService = module.get(PrismaService);
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    delete process.env.GROQ_API_KEY;
  });

  // Test 1: throws BadRequestException when query is empty string
  it("should throw BadRequestException when query is empty", async () => {
    await expect(service.query(mockUser, { query: "" })).rejects.toThrow(
      BadRequestException,
    );
  });

  // Test 2: throws ServiceUnavailableException when GROQ_API_KEY is not set
  it("should throw ServiceUnavailableException when GROQ_API_KEY is not set", async () => {
    // Create a new service instance without the env var set
    delete process.env.GROQ_API_KEY;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: PrismaService,
          useValue: {
            loan: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
            payment: { findMany: jest.fn() },
            customer: { findMany: jest.fn() },
          },
        },
        {
          provide: InterestService,
          useValue: {
            calculateAccruedInterest: jest.fn().mockReturnValue(0n),
            calculateOutstandingInterest: jest.fn().mockReturnValue(0n),
            calculateOutstandingPrincipal: jest.fn().mockReturnValue(0n),
          },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    const serviceWithoutKey = module.get<AiService>(AiService);
    await expect(
      serviceWithoutKey.query(mockUser, { query: "show me loans" }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  // Test 3: returns answer when Groq responds with no tool calls
  it("should return answer when Groq responds with no tool calls", async () => {
    mockGroq.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            content: "There are no overdue loans at the moment.",
            tool_calls: null,
          },
        },
      ],
    });

    const result = await service.query(mockUser, {
      query: "show overdue loans",
    });

    expect(result.answer).toBe("There are no overdue loans at the moment.");
    expect(result.toolsUsed).toEqual([]);
    expect(result.dataRetrievedAt).toBeDefined();
  });

  // Test 4: executes tool calls and makes follow-up call with tool results
  it("should execute tool calls and make follow-up call with tool results", async () => {
    (prismaService.loan.findMany as jest.Mock).mockResolvedValue([]);

    // First response: request a tool call
    mockGroq.chat.completions.create
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: {
                    name: "get_overdue_loans",
                    arguments: "{}",
                  },
                },
              ],
            },
          },
        ],
      })
      // Second response: final answer
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: "There are 0 overdue loans.",
              tool_calls: null,
            },
          },
        ],
      });

    const result = await service.query(mockUser, {
      query: "show overdue loans",
    });

    expect(mockGroq.chat.completions.create).toHaveBeenCalledTimes(2);
    expect(result.answer).toBe("There are 0 overdue loans.");
  });

  // Test 5: includes toolsUsed array in response
  it("should include toolsUsed array in response", async () => {
    (prismaService.loan.findMany as jest.Mock).mockResolvedValue([]);

    mockGroq.chat.completions.create
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: { name: "get_loan_summary", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: "Summary retrieved.",
              tool_calls: null,
            },
          },
        ],
      });

    (prismaService.loan.count as jest.Mock).mockResolvedValue(0);
    (prismaService.loan.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.query(mockUser, {
      query: "give me a summary",
    });

    expect(result.toolsUsed).toContain("get_loan_summary");
  });

  // Test 6: logs AI_QUERY_EXECUTED audit event after successful query
  it("should log AI_QUERY_EXECUTED audit event after successful query", async () => {
    mockGroq.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Done.",
            tool_calls: null,
          },
        },
      ],
    });

    await service.query(mockUser, { query: "how many loans?" });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuditEventType.AI_QUERY_EXECUTED,
        performedById: mockUser.sub,
        performedByName: mockUser.email,
        affectedModel: "AI",
      }),
    );
  });

  // Test 7: when 'get_overdue_loans' tool is called, calls prisma.loan.findMany with correct where clause
  it("should call prisma.loan.findMany with correct where clause for get_overdue_loans", async () => {
    (prismaService.loan.findMany as jest.Mock).mockResolvedValue([]);

    mockGroq.chat.completions.create
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: { name: "get_overdue_loans", arguments: "{}" },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: "No overdue loans found.",
              tool_calls: null,
            },
          },
        ],
      });

    await service.query(mockUser, { query: "overdue loans?" });

    expect(prismaService.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: expect.objectContaining({ lt: expect.any(Date) }),
          status: expect.objectContaining({ notIn: expect.any(Array) }),
        }),
      }),
    );
  });

  // Test 8: wraps unexpected Groq errors in ServiceUnavailableException
  it("should wrap unexpected Groq errors in ServiceUnavailableException", async () => {
    mockGroq.chat.completions.create.mockRejectedValueOnce(
      new Error("Network error"),
    );

    await expect(
      service.query(mockUser, { query: "show loans" }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
