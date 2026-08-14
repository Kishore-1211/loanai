# GoldLoan AI — Task Tracker

## TASK-001: Authentication
- **Owner:** Backend Engineer
- **Status:** DONE
- **Requirements:** FR-AUTH-001 through FR-AUTH-009
- **Acceptance Criteria:** AC-AUTH-001, AC-AUTH-002
- **Completed:** 2026-08-13
- **Notes:** JWT access tokens (15m), httpOnly refresh tokens (7d), in-memory login lockout (5 failures / 15 min window), cookie-parser added to main.ts, seed script creates default owner account.

## TASK-002: User Management
- **Owner:** Backend Engineer
- **Status:** DONE
- **Requirements:** FR-USER-001 through FR-USER-007
- **Acceptance Criteria:** Per docs/PRD.md FR-USER-001 through FR-USER-007
- **Completed:** 2026-08-13
- **Notes:** @OwnerOnly() decorator added; PermissionsGuard updated to check owner-only metadata; 5 CRUD endpoints; passwordHash never returned; USER_CREATED/USER_DEACTIVATED/USER_PERMISSION_CHANGED audit events.

## TASK-003: Customer Management
- **Owner:** Backend Engineer
- **Status:** DONE
- **Requirements:** FR-CUST-001 through FR-CUST-008
- **Acceptance Criteria:** AC-CUST-001, AC-CUST-002
- **Completed:** 2026-08-13
- **Notes:** Bootstrapped NestJS project. Auth stubs in place. File upload endpoints stubbed (501) pending Supabase integration.

## TASK-004: Gold Item Management
- **Owner:** Backend Engineer
- **Status:** DONE
- **Requirements:** FR-GOLD-001 through FR-GOLD-006
- **Acceptance Criteria:** Per docs/PRD.md
- **Completed:** 2026-08-13
- **Notes:** @RequireAnyPermission decorator added; PermissionsGuard extended with OR-logic; gold items created with loanId=null (linked during loan creation in TASK-005); photo upload stubbed 501; GoldItemsService exported for LoansModule use.

## TASK-005: Loan Management
- **Owner:** Backend Engineer
- **Status:** DONE
- **Requirements:** FR-LOAN-001 through FR-LOAN-010, FR-INT-001 through FR-INT-009
- **Acceptance Criteria:** AC-LOAN-001, AC-INT-001
- **Completed:** 2026-08-13
- **Notes:** InterestService isolated pure functions (BigInt, no float); complete-months-only for partial month (OD-005 pending decision); OVERDUE computed at query time not stored; loan number GL-{n} from 1001; goldItemIds validated and linked in transaction; LoansService and InterestService exported for PaymentsModule use.

## TASK-006: Interest Calculation
- **Owner:** Backend Engineer
- **Status:** DONE
- **Requirements:** FR-INT-001 through FR-INT-009
- **Acceptance Criteria:** AC-INT-001
- **Completed:** 2026-08-13
- **Notes:** Implemented as InterestService in TASK-005 (src/loans/interest.service.ts). Pure BigInt functions, no floating point, complete-months-only rule, 15 unit tests all passing.

## TASK-007: Payment Recording
- **Owner:** Backend Engineer
- **Status:** DONE
- **Requirements:** FR-PAY-001 through FR-PAY-009, BR-FIN-001 through BR-FIN-012
- **Acceptance Criteria:** AC-PAY-001, AC-PAY-002
- **Completed:** 2026-08-13
- **Notes:** Interest-first allocation implemented in BigInt; paymentType computed server-side (not from client); interest calculated as-of payment date; overpayment capped at outstanding; full settlement updates loan+goldItems atomically in transaction; LoanPaymentsController handles GET /loans/:loanId/payments without circular deps.

## TASK-008: Receipt Generation
- **Owner:** Backend Engineer
- **Status:** DONE
- **Requirements:** FR-REC-001 through FR-REC-006
- **Acceptance Criteria:** AC-REC-001
- **Completed:** 2026-08-13
- **Notes:** Point-in-time snapshot — businessName/address copied from BusinessSettings at generation time; outstandingAfterPaise computed from all loan payments as of payment date; receiptNumber REC-XXXXX from 10001; immutable (no UPDATE/DELETE); PDF/HTML rendering delegated to frontend using returned JSON data.

## TASK-009: Reports
- **Owner:** Backend Engineer
- **Status:** DONE
- **Requirements:** FR-REP-001 through FR-REP-005
- **Acceptance Criteria:** Per docs/PRD.md
- **Completed:** 2026-08-13
- **Notes:** 7 report endpoints under /api/v1/reports — daily-collection, monthly-collection, outstanding, overdue, interest-income, loan-summary, customer-ledger/:customerId. All require VIEW_REPORTS permission. All outstanding amounts computed in real-time via InterestService. BigInt serialized to string. CSV/PDF export delegated to frontend (P2 scope).

## TASK-010: Audit Logs API
- **Owner:** Backend Engineer
- **Status:** DONE
- **Requirements:** FR-AUD-001 through FR-AUD-005
- **Acceptance Criteria:** AC-AUD-001, AC-AUD-002
- **Completed:** 2026-08-13
- **Notes:** Single GET /audit-logs endpoint, OWNER role only (@OwnerOnly). Filters: eventType, performedById, affectedId, affectedModel (case-insensitive contains), fromDate, toDate. Paginated (default 20, max 50). No write endpoints — audit logs are immutable from the API. findAll() added to existing AuditService; AuditLogsController added to existing AuditModule.

## TASK-011: AI Assistant
- **Owner:** AI Engineer
- **Status:** DONE
- **Requirements:** FR-AI-001 through FR-AI-010
- **Acceptance Criteria:** AC-AI-001, AC-AI-002
- **Completed:** 2026-08-13
- **Notes:** POST /ai/query endpoint. LLM: Groq llama-3.3-70b-versatile via groq-sdk. 10 backend tools: get_overdue_loans, get_due_loans, get_outstanding_summary, get_collection_summary, search_customers, get_customer_loans, get_loan_details, get_interest_income, get_loan_summary, search_loans. Tool calling loop (max 5 rounds). All monetary values converted from BigInt paise before returning to LLM. AI_QUERY_EXECUTED audit log on every query. Non-streaming JSON response. Requires USE_AI_ASSISTANT permission. Requires GROQ_API_KEY env var.

## TASK-012: Business Settings
- **Owner:** Backend Engineer
- **Status:** DONE
- **Requirements:** FR-SET-001 through FR-SET-003
- **Acceptance Criteria:** Per docs/PRD.md
- **Completed:** 2026-08-13
- **Notes:** GET /settings (any authenticated user) + PATCH /settings (OWNER only). Singleton row id="singleton" created by seed. All fields optional in PATCH. SETTINGS_CHANGED audit event logs before/after values. SettingsService exported for potential use by other modules (e.g. ReceiptsService already reads settings directly via Prisma).
