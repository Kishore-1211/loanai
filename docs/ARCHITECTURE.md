# GoldLoan AI — Architecture Document

**Version:** 1.0
**Author:** Architect Agent
**Date:** 2026-08-13
**Status:** Draft

---

## 1. System Overview

GoldLoan AI is a three-tier web application:

```
[Browser / Mobile Browser]
        |  HTTPS
        v
[Next.js Frontend]          <- UI, forms, dashboard, AI chat
        |  REST API / HTTPS
        v
[NestJS Backend API]        <- Business logic, auth, financial rules
        |
        |-------> [PostgreSQL]       <- Primary data store
        |-------> [Supabase Storage] <- Images and documents
        |-------> [LLM API]          <- AI queries only (read-only)
```

---

## 2. Technology Stack

### Frontend
- Next.js 14+ with App Router
- React 18+
- TypeScript 5+
- Tailwind CSS
- React Hook Form (form management)
- Zod (schema validation)
- TanStack Query (server state, caching)
- Axios (HTTP client with interceptors)

### Backend
- NestJS 10+
- TypeScript 5+
- Prisma ORM
- PostgreSQL 15+
- Passport.js + JWT strategy
- bcrypt (password hashing)
- class-validator + class-transformer (DTO validation)
- Decimal.js or BigInt arithmetic (monetary values)
- @nestjs/throttler (rate limiting)
- Helmet (security headers)

### Storage
- Supabase Storage (customer photos, ID documents, gold item photos)
- Files accessed via signed URLs or public CDN URLs
- Supabase service role key never exposed to frontend

### AI
- Claude API (Anthropic) — claude-sonnet-4-6 or later
- Tool-calling pattern for structured backend data retrieval
- AI layer calls backend services, not the database directly

### Infrastructure
- Docker Compose for local development
- Environment variables for all secrets
- Node.js 20+ LTS

---

## 3. Backend Module Structure

```
backend/
└── src/
    ├── main.ts
    ├── app.module.ts
    │
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── strategies/
    │   │   ├── jwt.strategy.ts
    │   │   └── local.strategy.ts
    │   └── guards/
    │       ├── jwt-auth.guard.ts
    │       └── permissions.guard.ts
    │
    ├── users/
    │   ├── users.module.ts
    │   ├── users.controller.ts
    │   ├── users.service.ts
    │   └── dto/
    │
    ├── customers/
    │   ├── customers.module.ts
    │   ├── customers.controller.ts
    │   ├── customers.service.ts
    │   └── dto/
    │
    ├── gold-items/
    │   ├── gold-items.module.ts
    │   ├── gold-items.controller.ts
    │   ├── gold-items.service.ts
    │   └── dto/
    │
    ├── loans/
    │   ├── loans.module.ts
    │   ├── loans.controller.ts
    │   ├── loans.service.ts
    │   ├── interest.service.ts       <- isolated, pure, testable
    │   └── dto/
    │
    ├── payments/
    │   ├── payments.module.ts
    │   ├── payments.controller.ts
    │   ├── payments.service.ts
    │   └── dto/
    │
    ├── receipts/
    │   ├── receipts.module.ts
    │   ├── receipts.controller.ts
    │   └── receipts.service.ts
    │
    ├── reports/
    │   ├── reports.module.ts
    │   ├── reports.controller.ts
    │   └── reports.service.ts
    │
    ├── audit/
    │   ├── audit.module.ts
    │   ├── audit.service.ts
    │   └── audit.types.ts
    │
    ├── ai/
    │   ├── ai.module.ts
    │   ├── ai.controller.ts
    │   ├── ai.service.ts
    │   ├── ai.types.ts
    │   ├── prompts/
    │   │   └── system.prompt.ts
    │   └── tools/
    │       ├── customer.tools.ts
    │       ├── loan.tools.ts
    │       ├── payment.tools.ts
    │       └── report.tools.ts
    │
    ├── settings/
    │   ├── settings.module.ts
    │   ├── settings.controller.ts
    │   └── settings.service.ts
    │
    ├── storage/
    │   ├── storage.module.ts
    │   └── storage.service.ts
    │
    ├── common/
    │   ├── decorators/
    │   │   ├── current-user.decorator.ts
    │   │   └── permissions.decorator.ts
    │   ├── filters/
    │   │   └── http-exception.filter.ts
    │   ├── interceptors/
    │   │   └── response.interceptor.ts
    │   └── types/
    │       └── jwt-payload.type.ts
    │
    └── prisma/
        ├── prisma.module.ts
        └── prisma.service.ts
```

---

## 4. Frontend Structure

```
frontend/
└── app/
    ├── (auth)/
    │   └── login/page.tsx
    │
    └── (dashboard)/
        ├── layout.tsx                <- sidebar, navbar, auth guard
        ├── dashboard/page.tsx
        ├── customers/
        │   ├── page.tsx              <- list + search
        │   ├── new/page.tsx
        │   └── [id]/page.tsx         <- details, loans, history
        ├── loans/
        │   ├── page.tsx              <- all loans
        │   ├── new/page.tsx
        │   ├── overdue/page.tsx
        │   └── [id]/page.tsx         <- loan detail + payment history
        ├── payments/
        │   └── [loanId]/new/page.tsx <- record payment
        ├── receipts/
        │   └── [id]/page.tsx         <- print/view receipt
        ├── reports/page.tsx
        ├── ai/page.tsx               <- AI chat interface
        ├── staff/page.tsx            <- staff management
        └── settings/page.tsx

frontend/
├── components/
│   ├── ui/                          <- buttons, inputs, cards, modals, tables
│   ├── forms/                       <- CustomerForm, LoanForm, PaymentForm
│   ├── layout/                      <- Sidebar, Navbar, PageHeader
│   └── financial/                   <- OutstandingCard, LoanStatusBadge, CurrencyDisplay
├── lib/
│   ├── api.ts                       <- axios instance with auth interceptor
│   ├── auth.ts                      <- token management
│   └── format.ts                    <- formatCurrency, formatDate, formatPaise
├── hooks/
│   ├── useAuth.ts
│   ├── useCustomers.ts
│   ├── useLoans.ts
│   └── usePayments.ts
└── types/
    └── index.ts
```

---

## 5. Request Flow

### Standard API Request

```
Browser
  1. User action (form submit, button)
     |
  2. HTTP request: Authorization: Bearer <access-token>
     |
  v
NestJS Controller
  3. JwtAuthGuard: validates token signature and expiry
  4. PermissionsGuard: checks required permission against JWT payload
  5. ValidationPipe: validates and sanitizes DTO
     |
  v
Service Layer
  6. Business logic executed
  7. Prisma query to PostgreSQL
  8. Financial calculations via InterestService (paise arithmetic)
     |
  v
Database returns result
     |
  9. AuditService.log() called inside same transaction (for mutations)
     |
  10. ResponseInterceptor shapes { success, data } response
     |
  v
Browser receives formatted response
```

### AI Query Flow

```
Browser
  1. User sends natural-language query
     |
  v
AI Controller
  2. JWT + USE_AI_ASSISTANT permission check
     |
  v
AI Service
  3. System prompt + user message + tool definitions sent to LLM API
     |
  v
LLM
  4. LLM selects tool and parameters
     |
  v
Tool Handler
  5. Tool validates its inputs
  6. Tool checks user permissions again
  7. Tool calls authorized backend service method
  8. Backend service queries database
  9. Real validated data returned
     |
  v
LLM
  10. LLM formats natural-language response from real data
     |
  v
AI Controller
  11. Response returned (or streamed) to browser
```

---

## 6. Interest Calculation Architecture

Interest calculation is an isolated, pure, fully testable service.
It has no side effects and makes no database mutations.

```typescript
// interest.service.ts
calculateAccruedInterest(
  principalPaise: bigint,
  monthlyRateBps: number,
  startDate: Date,
  asOfDate: Date
): bigint

calculateOutstandingInterest(
  totalAccruedPaise: bigint,
  totalInterestPaidPaise: bigint
): bigint

calculateOutstandingPrincipal(
  originalPrincipalPaise: bigint,
  totalPrincipalPaidPaise: bigint
): bigint

calculateTotalOutstanding(
  outstandingPrincipalPaise: bigint,
  outstandingInterestPaise: bigint
): bigint
```

Rules enforced in InterestService:
- All inputs and outputs are BigInt (paise)
- No floating-point math
- Monthly rate in basis points (200 bps = 2.00% per month)
- Partial month calculation follows OD-005 decision
- Functions are deterministic given the same inputs

---

## 7. Payment Processing Architecture

Payment recording uses a Prisma database transaction to ensure atomicity:

```
PaymentService.recordPayment(dto, requestingUser)
  |
  Prisma.$transaction([
    1. Fetch loan record (with lock)
    2. Verify loan is ACTIVE or OVERDUE (not SETTLED/CLOSED)
    3. Calculate accrued interest via InterestService
    4. Calculate outstanding principal from prior payments
    5. Validate payment amount >= 1 paise
    6. Allocate payment: interest first, then principal
    7. Create Payment record
    8. If fully settled:
         - Update Loan.status = SETTLED, Loan.settledAt = now
         - Update all GoldItems.status = RELEASED
    9. Create AuditLog entry
  ])
  |
  Return payment result + updated outstanding amounts
```

If any step fails, the entire transaction rolls back.
No partial state is possible after a failed payment.

---

## 8. Authentication Architecture

```
POST /auth/login
  -> LocalStrategy validates email + bcrypt password comparison
  -> Issues access token (JWT, 15 min, HS256)
  -> Issues refresh token (stored in httpOnly Secure cookie)

POST /auth/refresh
  -> Validates refresh token from cookie
  -> Issues new access token

POST /auth/logout
  -> Clears refresh token cookie
```

JWT Access Token Payload:
```json
{
  "sub": "user-uuid",
  "email": "user@shop.com",
  "role": "OWNER",
  "permissions": ["CREATE_LOAN", "VIEW_REPORTS"],
  "iat": 1234567890,
  "exp": 1234568790
}
```

Guards:
- JwtAuthGuard: Applied globally via APP_GUARD. All routes protected by default.
- PermissionsGuard: Applied per-controller or per-route via @RequirePermissions() decorator.
- Public routes decorated with @Public() to bypass JwtAuthGuard.

---

## 9. Authorization Architecture

### Two Layers on Every Protected Endpoint

**Layer 1:** Authentication — valid JWT required (JwtAuthGuard)

**Layer 2:** Permission — required permission present in JWT payload (PermissionsGuard)

```
@Controller('loans')
@RequirePermissions(Permission.CREATE_LOAN)
async createLoan(@Body() dto, @CurrentUser() user) {
  // user.id comes from validated JWT, not from request body
  // ownership checks performed in service, not controller
}
```

Permission List:
```
CREATE_CUSTOMER
VIEW_ALL_CUSTOMERS
CREATE_LOAN
VIEW_ALL_LOANS
RECORD_PAYMENT
VIEW_OVERDUE_LOANS
VIEW_REPORTS
USE_AI_ASSISTANT
MANAGE_STAFF
```

Owner has all permissions by role. Staff have only assigned permissions.
Frontend may hide buttons. Backend always enforces independently.

---

## 10. Error Handling Strategy

All errors return a consistent envelope:

```json
{
  "success": false,
  "statusCode": 400,
  "error": "ValidationError",
  "message": "Principal amount must be greater than zero",
  "timestamp": "2026-08-13T10:00:00Z",
  "path": "/api/v1/loans"
}
```

Global HttpExceptionFilter catches all exceptions.
Financial operation errors never fail silently.
If a payment transaction fails, the entire operation rolls back and an error is returned.
Stack traces never exposed to clients in production.

---

## 11. Storage Architecture

Supabase Storage for: customer photos, customer ID documents, gold item photos.

Upload flow:
```
Frontend selects file
  -> POST /api/v1/customers/:id/photo (multipart/form-data)
  -> Backend validates file type and size
  -> Backend uploads to Supabase Storage via service role key
  -> Supabase returns URL
  -> Backend stores URL in database
  -> Backend returns URL to frontend
```

Rules:
- Max file size: 5MB
- Accepted types: image/jpeg, image/png, application/pdf
- Supabase service role key is backend-only (never sent to client)
- File paths organized: customers/{customerId}/photo.jpg, gold-items/{itemId}/photo.jpg

---

## 12. Testing Strategy

```
Unit Tests (Jest)
  - interest.service.ts: all calculation functions
  - payment allocation logic
  - outstanding balance calculations
  - due date calculations
  - overdue detection logic
  - DTO validation rules
  - permission guard logic

Integration Tests (Jest + Prisma test database)
  - Customer creation and search
  - Loan creation with gold items
  - Payment recording with full transaction
  - Full settlement flow (loan settled, gold items released)
  - Overdue loan detection
  - Authentication (login, refresh, logout)
  - Report data accuracy
  - AI tool results match direct DB queries

End-to-End Tests (Playwright)
  - Login -> Dashboard
  - Create Customer -> Create Loan
  - Record Payment -> View Updated Balance -> Generate Receipt
  - Overdue loans list accuracy
  - AI query returning correct results
```

---

## 13. Deployment Architecture

### Local Development
```
docker-compose.yml
  - postgres:15
  - backend (NestJS on port 3001)
  - frontend (Next.js on port 3000)
```

### Production (MVP)
```
Database:  Managed PostgreSQL (Railway / Supabase / RDS)
Backend:   Railway / Render / Docker on VPS  (port 3001)
Frontend:  Vercel
Storage:   Supabase Storage
AI:        Claude API (Anthropic)
```

### Environment Variables

Backend (.env):
```
DATABASE_URL=postgresql://...
JWT_SECRET=<256-bit random>
JWT_REFRESH_SECRET=<256-bit random>
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
FRONTEND_URL=https://yourapp.vercel.app
NODE_ENV=production
PORT=3001
```

Frontend (.env.local):
```
NEXT_PUBLIC_API_URL=https://yourbackend.railway.app/api/v1
```

Nothing else belongs in the frontend environment.
Database credentials, JWT secrets, and API keys must never appear in the frontend build.

---

## 14. Key Architectural Decisions

| Decision | Choice | Reason |
|---|---|---|
| Monetary storage | BigInt (paise) | Eliminates floating-point errors |
| Interest rate storage | Basis points (Int) | Avoids float, precise comparisons |
| Payment immutability | No UPDATE/DELETE on payments | Financial audit integrity |
| Audit log immutability | Append-only | Tamper-proof financial history |
| AI data access | Backend tools only | AI never touches DB directly |
| Authorization location | Backend only | Frontend hiding is UX, not security |
| Business settings | Singleton row | Single shop MVP, simple pattern |
| Receipt data | Snapshot at generation | Historical accuracy preserved |
