import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import Groq from "groq-sdk";
import { AuditEventType, LoanStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InterestService } from "../loans/interest.service";
import { AuditService } from "../audit/audit.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { AiQueryDto } from "./dto/ai-query.dto";

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "get_overdue_loans",
      description:
        "Get all overdue loans with days overdue and outstanding amounts",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_due_loans",
      description: "Get loans due within N days from today",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Number of days (default 7)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_outstanding_summary",
      description:
        "Get total outstanding principal and interest across all active/overdue loans",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_collection_summary",
      description: "Get total payments collected between two dates",
      parameters: {
        type: "object",
        properties: {
          fromDate: { type: "string", description: "YYYY-MM-DD" },
          toDate: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["fromDate", "toDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_customers",
      description: "Search customers by name or mobile number",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customer_loans",
      description: "Get all loans for a customer by their ID",
      parameters: {
        type: "object",
        properties: { customerId: { type: "string" } },
        required: ["customerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_loan_details",
      description:
        "Get full loan details including real-time outstanding amounts",
      parameters: {
        type: "object",
        properties: { loanId: { type: "string" } },
        required: ["loanId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_interest_income",
      description: "Get total interest collected in a date range",
      parameters: {
        type: "object",
        properties: {
          fromDate: { type: "string" },
          toDate: { type: "string" },
        },
        required: ["fromDate", "toDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_loan_summary",
      description:
        "Get business summary: loan counts by status and total current outstanding",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "search_loans",
      description: "Search loans by status, customer name, or loan number",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["ACTIVE", "OVERDUE", "SETTLED", "CLOSED"],
          },
          customerName: { type: "string" },
          loanNumber: { type: "string" },
        },
      },
    },
  },
];

@Injectable()
export class AiService {
  private groq: Groq | null = null;
  private readonly model = "llama-3.3-70b-versatile";

  constructor(
    private readonly prisma: PrismaService,
    private readonly interestService: InterestService,
    private readonly auditService: AuditService,
  ) {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      this.groq = new Groq({ apiKey });
    }
  }

  async query(user: JwtPayload, dto: AiQueryDto) {
    if (!dto.query?.trim()) {
      throw new BadRequestException("Query cannot be empty");
    }
    if (!this.groq) {
      throw new ServiceUnavailableException(
        "AI service not configured: GROQ_API_KEY is missing",
      );
    }

    const dataRetrievedAt = new Date();
    const toolsUsed: string[] = [];
    let answer = "";

    const messages: any[] = [
      {
        role: "system",
        content: `You are a read-only business intelligence assistant for a gold loan shop management system.
You have access to tools that retrieve real data from the database. Always use tools to get data — never invent or estimate financial figures.
All monetary values in the database are stored in paise (1 rupee = 100 paise). When displaying amounts, convert to rupees with 2 decimal places and prefix with "Rs.".
Format Indian currency with commas (e.g. Rs. 1,06,000.00).
If data is not found, say so explicitly. Do not guess.
If a query is ambiguous, ask a clarifying question.
Today's date is ${new Date().toISOString().split("T")[0]}.`,
      },
      { role: "user", content: dto.query },
    ];

    const MAX_TOOL_ROUNDS = 5;

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await this.groq.chat.completions.create({
          model: this.model,
          messages,
          tools: TOOL_DEFINITIONS as any,
          tool_choice: "auto",
          max_tokens: 2048,
        });

        const choice = response.choices[0];
        const assistantMessage = choice.message;

        if (!assistantMessage.tool_calls?.length) {
          // Final answer — no more tool calls
          answer = assistantMessage.content ?? "";
          break;
        }

        // Push assistant message (with tool_calls) to history
        messages.push(assistantMessage);

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

          if (!toolsUsed.includes(toolName)) toolsUsed.push(toolName);

          let toolResult: any;
          try {
            toolResult = await this.executeTool(toolName, toolArgs);
          } catch (err: any) {
            toolResult = { error: `Tool execution failed: ${err.message}` };
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }

        // If last round and still tool calls, break (safety)
        if (round === MAX_TOOL_ROUNDS - 1) {
          answer =
            "I was unable to complete the query within the allowed steps. Please try a more specific question.";
        }
      }
    } catch (err: any) {
      if (
        err instanceof BadRequestException ||
        err instanceof ServiceUnavailableException
      )
        throw err;
      throw new ServiceUnavailableException(`AI service error: ${err.message}`);
    }

    // Audit log
    await this.auditService.log({
      eventType: AuditEventType.AI_QUERY_EXECUTED,
      performedById: user.sub,
      performedByName: user.email,
      affectedModel: "AI",
      affectedId: user.sub,
      afterValue: { query: dto.query, toolsUsed, answerLength: answer.length },
    });

    return {
      answer,
      toolsUsed,
      dataRetrievedAt: dataRetrievedAt.toISOString(),
    };
  }

  private async executeTool(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "get_overdue_loans":
        return this.toolGetOverdueLoans();
      case "get_due_loans":
        return this.toolGetDueLoans(args.days ?? 7);
      case "get_outstanding_summary":
        return this.toolGetOutstandingSummary();
      case "get_collection_summary":
        return this.toolGetCollectionSummary(args.fromDate, args.toDate);
      case "search_customers":
        return this.toolSearchCustomers(args.query);
      case "get_customer_loans":
        return this.toolGetCustomerLoans(args.customerId);
      case "get_loan_details":
        return this.toolGetLoanDetails(args.loanId);
      case "get_interest_income":
        return this.toolGetInterestIncome(args.fromDate, args.toDate);
      case "get_loan_summary":
        return this.toolGetLoanSummary();
      case "search_loans":
        return this.toolSearchLoans(args);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  private async toolGetOverdueLoans() {
    const now = new Date();
    const loans = await this.prisma.loan.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: [LoanStatus.SETTLED, LoanStatus.CLOSED] },
      },
      include: {
        customer: { select: { fullName: true, mobileNumber: true } },
        payments: true,
      },
      orderBy: { dueDate: "asc" },
    });
    const msPerDay = 86400000;
    return loans.map((loan) => {
      const totalInterestPaid = loan.payments.reduce(
        (s, p) => s + BigInt((p as any).interestAmountPaise),
        0n,
      );
      const totalPrincipalPaid = loan.payments.reduce(
        (s, p) => s + BigInt((p as any).principalAmountPaise),
        0n,
      );
      const accrued = this.interestService.calculateAccruedInterest(
        BigInt((loan as any).principalPaise),
        loan.monthlyRateBps,
        loan.startDate,
        now,
      );
      const outstanding =
        this.interestService.calculateOutstandingInterest(
          accrued,
          totalInterestPaid,
        ) +
        this.interestService.calculateOutstandingPrincipal(
          BigInt((loan as any).principalPaise),
          totalPrincipalPaid,
        );
      return {
        loanNumber: loan.loanNumber,
        customerName: loan.customer.fullName,
        customerMobile: loan.customer.mobileNumber,
        dueDate: loan.dueDate.toISOString().split("T")[0],
        daysOverdue: Math.floor(
          (now.getTime() - loan.dueDate.getTime()) / msPerDay,
        ),
        totalOutstandingPaise: outstanding.toString(),
      };
    });
  }

  private async toolGetDueLoans(days: number) {
    const now = new Date();
    const future = new Date(now.getTime() + days * 86400000);
    const loans = await this.prisma.loan.findMany({
      where: {
        dueDate: { gte: now, lte: future },
        status: LoanStatus.ACTIVE,
      },
      include: { customer: { select: { fullName: true, mobileNumber: true } } },
      orderBy: { dueDate: "asc" },
    });
    return loans.map((loan) => ({
      loanNumber: loan.loanNumber,
      customerName: loan.customer.fullName,
      dueDate: loan.dueDate.toISOString().split("T")[0],
      principalPaise: loan.principalPaise.toString(),
    }));
  }

  private async toolGetOutstandingSummary() {
    const now = new Date();
    const loans = await this.prisma.loan.findMany({
      where: { status: { notIn: [LoanStatus.SETTLED, LoanStatus.CLOSED] } },
      include: { payments: true },
    });
    let totalOutstanding = 0n;
    let totalInterestOutstanding = 0n;
    let totalPrincipalOutstanding = 0n;
    for (const loan of loans) {
      const tp = loan.payments.reduce(
        (s, p) => s + BigInt((p as any).interestAmountPaise),
        0n,
      );
      const pp = loan.payments.reduce(
        (s, p) => s + BigInt((p as any).principalAmountPaise),
        0n,
      );
      const accrued = this.interestService.calculateAccruedInterest(
        BigInt((loan as any).principalPaise),
        loan.monthlyRateBps,
        loan.startDate,
        now,
      );
      const oi = this.interestService.calculateOutstandingInterest(accrued, tp);
      const op = this.interestService.calculateOutstandingPrincipal(
        BigInt((loan as any).principalPaise),
        pp,
      );
      totalInterestOutstanding += oi;
      totalPrincipalOutstanding += op;
      totalOutstanding += oi + op;
    }
    return {
      activeLoanCount: loans.length,
      totalOutstandingPaise: totalOutstanding.toString(),
      totalInterestOutstandingPaise: totalInterestOutstanding.toString(),
      totalPrincipalOutstandingPaise: totalPrincipalOutstanding.toString(),
    };
  }

  private async toolGetCollectionSummary(fromDate: string, toDate: string) {
    const from = new Date(fromDate);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setUTCDate(to.getUTCDate() + 1);
    to.setUTCHours(0, 0, 0, 0);
    const payments = await this.prisma.payment.findMany({
      where: { paymentDate: { gte: from, lt: to } },
    });
    const total = payments.reduce(
      (s, p) => s + BigInt((p as any).totalAmountPaise),
      0n,
    );
    const interest = payments.reduce(
      (s, p) => s + BigInt((p as any).interestAmountPaise),
      0n,
    );
    const principal = payments.reduce(
      (s, p) => s + BigInt((p as any).principalAmountPaise),
      0n,
    );
    return {
      fromDate,
      toDate,
      paymentCount: payments.length,
      totalCollectedPaise: total.toString(),
      interestCollectedPaise: interest.toString(),
      principalCollectedPaise: principal.toString(),
    };
  }

  private async toolSearchCustomers(query: string) {
    const customers = await this.prisma.customer.findMany({
      where: {
        OR: [
          { fullName: { contains: query, mode: "insensitive" } },
          { mobileNumber: { contains: query } },
        ],
      },
      select: { id: true, fullName: true, mobileNumber: true, isActive: true },
      take: 10,
    });
    return customers;
  }

  private async toolGetCustomerLoans(customerId: string) {
    const loans = await this.prisma.loan.findMany({
      where: { customerId },
      include: { customer: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return loans.map((l) => ({
      loanNumber: l.loanNumber,
      principalPaise: l.principalPaise.toString(),
      status: l.status,
      dueDate: l.dueDate.toISOString().split("T")[0],
      startDate: l.startDate.toISOString().split("T")[0],
    }));
  }

  private async toolGetLoanDetails(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        customer: { select: { fullName: true, mobileNumber: true } },
        payments: true,
      },
    });
    if (!loan) return { error: "Loan not found" };
    const now = new Date();
    const tp = loan.payments.reduce(
      (s, p) => s + BigInt((p as any).interestAmountPaise),
      0n,
    );
    const pp = loan.payments.reduce(
      (s, p) => s + BigInt((p as any).principalAmountPaise),
      0n,
    );
    const accrued = this.interestService.calculateAccruedInterest(
      BigInt((loan as any).principalPaise),
      loan.monthlyRateBps,
      loan.startDate,
      now,
    );
    const oi = this.interestService.calculateOutstandingInterest(accrued, tp);
    const op = this.interestService.calculateOutstandingPrincipal(
      BigInt((loan as any).principalPaise),
      pp,
    );
    return {
      loanNumber: loan.loanNumber,
      customerName: loan.customer.fullName,
      customerMobile: loan.customer.mobileNumber,
      principalPaise: loan.principalPaise.toString(),
      monthlyRateBps: loan.monthlyRateBps,
      status: loan.status,
      startDate: loan.startDate.toISOString().split("T")[0],
      dueDate: loan.dueDate.toISOString().split("T")[0],
      outstandingInterestPaise: oi.toString(),
      outstandingPrincipalPaise: op.toString(),
      totalOutstandingPaise: (oi + op).toString(),
    };
  }

  private async toolGetInterestIncome(fromDate: string, toDate: string) {
    const from = new Date(fromDate);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setUTCDate(to.getUTCDate() + 1);
    to.setUTCHours(0, 0, 0, 0);
    const payments = await this.prisma.payment.findMany({
      where: { paymentDate: { gte: from, lt: to } },
    });
    const interest = payments.reduce(
      (s, p) => s + BigInt((p as any).interestAmountPaise),
      0n,
    );
    return {
      fromDate,
      toDate,
      paymentCount: payments.length,
      totalInterestCollectedPaise: interest.toString(),
    };
  }

  private async toolGetLoanSummary() {
    const now = new Date();
    const [total, settled, closed, nonSettled] = await Promise.all([
      this.prisma.loan.count(),
      this.prisma.loan.count({ where: { status: LoanStatus.SETTLED } }),
      this.prisma.loan.count({ where: { status: LoanStatus.CLOSED } }),
      this.prisma.loan.findMany({
        where: {
          status: { notIn: [LoanStatus.SETTLED, LoanStatus.CLOSED] },
        },
        include: { payments: true },
      }),
    ]);
    const overdueCount = nonSettled.filter((l) => l.dueDate < now).length;
    const activeCount = nonSettled.filter((l) => l.dueDate >= now).length;
    let totalOutstanding = 0n;
    for (const loan of nonSettled) {
      const tp = loan.payments.reduce(
        (s, p) => s + BigInt((p as any).interestAmountPaise),
        0n,
      );
      const pp = loan.payments.reduce(
        (s, p) => s + BigInt((p as any).principalAmountPaise),
        0n,
      );
      const accrued = this.interestService.calculateAccruedInterest(
        BigInt((loan as any).principalPaise),
        loan.monthlyRateBps,
        loan.startDate,
        now,
      );
      const oi = this.interestService.calculateOutstandingInterest(accrued, tp);
      const op = this.interestService.calculateOutstandingPrincipal(
        BigInt((loan as any).principalPaise),
        pp,
      );
      totalOutstanding += oi + op;
    }
    return {
      totalLoansEver: total,
      activeLoans: activeCount,
      overdueLoans: overdueCount,
      settledLoans: settled,
      closedLoans: closed,
      totalCurrentOutstandingPaise: totalOutstanding.toString(),
    };
  }

  private async toolSearchLoans(args: {
    status?: string;
    customerName?: string;
    loanNumber?: string;
  }) {
    const where: any = {};
    if (args.status === "OVERDUE") {
      where.dueDate = { lt: new Date() };
      where.status = LoanStatus.ACTIVE;
    } else if (args.status) {
      where.status = args.status;
    }
    if (args.loanNumber)
      where.loanNumber = { contains: args.loanNumber, mode: "insensitive" };
    if (args.customerName)
      where.customer = {
        fullName: { contains: args.customerName, mode: "insensitive" },
      };
    const loans = await this.prisma.loan.findMany({
      where,
      include: { customer: { select: { fullName: true, mobileNumber: true } } },
      take: 20,
      orderBy: { createdAt: "desc" },
    });
    return loans.map((l) => ({
      loanNumber: l.loanNumber,
      customerName: l.customer.fullName,
      principalPaise: l.principalPaise.toString(),
      status: l.status,
      dueDate: l.dueDate.toISOString().split("T")[0],
    }));
  }
}
