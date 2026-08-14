# GoldLoan AI — Database Design

**Version:** 1.0
**Author:** Architect Agent
**Date:** 2026-08-13

---

## 1. Database

- Engine: PostgreSQL 15+
- ORM: Prisma
- Migration tool: Prisma Migrate
- All monetary values: BigInt (paise — 1 rupee = 100 paise)
- All interest rates: Int (basis points — 1% = 100 bps)

---

## 2. Entity Relationship Overview

```
User (owner or staff)
  |- created -> Loan[]
  |- recorded -> Payment[]
  |- performed -> AuditLog[]

Customer
  |- has -> Loan[]
  |- has -> GoldItem[]

Loan
  |- belongs to -> Customer
  |- created by -> User
  |- has -> GoldItem[] (pledged)
  |- has -> Payment[]

Payment
  |- belongs to -> Loan
  |- recorded by -> User
  |- has -> Receipt (0..1)

BusinessSettings  (singleton)
AuditLog          (append-only)
```

---

## 3. Enums

```prisma
enum Role {
  OWNER
  STAFF
}

enum Permission {
  CREATE_CUSTOMER
  VIEW_ALL_CUSTOMERS
  CREATE_LOAN
  VIEW_ALL_LOANS
  RECORD_PAYMENT
  VIEW_OVERDUE_LOANS
  VIEW_REPORTS
  USE_AI_ASSISTANT
  MANAGE_STAFF
}

enum LoanStatus {
  ACTIVE
  OVERDUE
  SETTLED
  CLOSED
}

enum GoldItemStatus {
  PLEDGED
  RELEASED
  AUCTIONED
}

enum PaymentMethod {
  CASH
  UPI
  BANK_TRANSFER
  CHEQUE
}

enum PaymentType {
  INTEREST_ONLY
  PRINCIPAL_AND_INTEREST
  FULL_SETTLEMENT
}

enum GoldPurity {
  K18
  K20
  K22
  K24
}

enum IdProofType {
  AADHAAR
  PAN
  VOTER_ID
  PASSPORT
  DRIVING_LICENSE
}

enum InterestType {
  FLAT_MONTHLY
  PER_ANNUM
}

enum AuditEventType {
  USER_CREATED
  USER_DEACTIVATED
  USER_PERMISSION_CHANGED
  CUSTOMER_CREATED
  CUSTOMER_UPDATED
  GOLD_ITEM_CREATED
  GOLD_ITEM_UPDATED
  LOAN_CREATED
  LOAN_UPDATED
  LOAN_SETTLED
  LOAN_CLOSED
  PAYMENT_RECORDED
  RECEIPT_GENERATED
  SETTINGS_CHANGED
  AI_QUERY_EXECUTED
}
```

---

## 4. Entity Definitions

### User

```prisma
model User {
  id           String       @id @default(uuid())
  email        String       @unique
  passwordHash String
  fullName     String
  role         Role
  permissions  Permission[]
  isActive     Boolean      @default(true)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  loansCreated     Loan[]      @relation("LoanCreatedBy")
  paymentsRecorded Payment[]   @relation("PaymentRecordedBy")
  auditLogs        AuditLog[]  @relation("AuditPerformedBy")
}
```

Constraints:
- email is UNIQUE
- passwordHash never returned in API responses
- Owners have permissions = [] (role grants all access)
- Staff have an explicit permissions array

Indexes:
- UNIQUE INDEX on email

---

### Customer

```prisma
model Customer {
  id            String      @id @default(uuid())
  fullName      String
  mobileNumber  String      @unique
  address       String
  idProofType   IdProofType
  idProofNumber String
  dateOfBirth   DateTime?
  photoUrl      String?
  idDocumentUrl String?
  isActive      Boolean     @default(true)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  loans     Loan[]
  goldItems GoldItem[]
}
```

Constraints:
- mobileNumber is UNIQUE
- Customer cannot be deleted if they have any Loan record (enforced at service layer)

Indexes:
- UNIQUE INDEX on mobileNumber
- INDEX on fullName (for ILIKE search)
- INDEX on idProofNumber (for search)

---

### GoldItem

```prisma
model GoldItem {
  id                  String         @id @default(uuid())
  customerId          String
  loanId              String?
  description         String
  weightGrams         Decimal        @db.Decimal(8, 3)
  purity              GoldPurity
  estimatedValuePaise BigInt
  photoUrl            String?
  conditionNotes      String?
  status              GoldItemStatus @default(PLEDGED)
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  customer Customer @relation(fields: [customerId], references: [id])
  loan     Loan?    @relation(fields: [loanId], references: [id])
}
```

Constraints:
- A GoldItem with status PLEDGED must have a loanId
- A GoldItem cannot be linked to two active loans simultaneously (enforced at service layer)
- estimatedValuePaise stored in paise (BigInt)
- weightGrams stored as Decimal(8,3) for gram precision

Indexes:
- INDEX on customerId
- INDEX on loanId
- INDEX on status

---

### Loan

```prisma
model Loan {
  id             String      @id @default(uuid())
  loanNumber     String      @unique
  customerId     String
  createdById    String
  principalPaise BigInt
  monthlyRateBps Int
  interestType   InterestType @default(FLAT_MONTHLY)
  startDate      DateTime
  dueDate        DateTime
  tenureMonths   Int
  status         LoanStatus  @default(ACTIVE)
  settledAt      DateTime?
  closedAt       DateTime?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  customer  Customer   @relation(fields: [customerId], references: [id])
  createdBy User       @relation("LoanCreatedBy", fields: [createdById], references: [id])
  goldItems GoldItem[]
  payments  Payment[]
}
```

Notes:
- principalPaise: original loan principal in paise (immutable after creation)
- monthlyRateBps: interest rate in basis points (immutable after creation; 200 = 2.00% per month)
- status OVERDUE is computed at query time, not stored (today > dueDate and not SETTLED/CLOSED)
  - Exception: a scheduled job may update status for performance, but display always recomputes
- loanNumber auto-generated by service: "GL-" + zero-padded sequence

Indexes:
- UNIQUE INDEX on loanNumber
- INDEX on customerId
- INDEX on status
- INDEX on dueDate (for overdue and due-soon queries)
- INDEX on createdById

---

### Payment

```prisma
model Payment {
  id                   String        @id @default(uuid())
  loanId               String
  recordedById         String
  paymentDate          DateTime
  totalAmountPaise     BigInt
  interestAmountPaise  BigInt
  principalAmountPaise BigInt
  paymentMethod        PaymentMethod
  paymentType          PaymentType
  referenceNumber      String?
  notes                String?
  createdAt            DateTime      @default(now())

  loan       Loan     @relation(fields: [loanId], references: [id])
  recordedBy User     @relation("PaymentRecordedBy", fields: [recordedById], references: [id])
  receipt    Receipt?
}
```

Constraints:
- Payment records are IMMUTABLE after creation (no UPDATE or DELETE at database or service layer)
- totalAmountPaise = interestAmountPaise + principalAmountPaise (enforced at service layer)
- totalAmountPaise >= 1 (minimum 1 paise)
- All amounts in paise (BigInt)

Indexes:
- INDEX on loanId
- INDEX on paymentDate
- INDEX on recordedById

---

### Receipt

```prisma
model Receipt {
  id                    String        @id @default(uuid())
  receiptNumber         String        @unique
  paymentId             String        @unique
  businessName          String
  businessAddress       String
  customerName          String
  customerMobile        String
  loanNumber            String
  paymentDate           DateTime
  amountPaidPaise       BigInt
  paymentMethod         PaymentMethod
  outstandingAfterPaise BigInt
  recordedByName        String
  footerText            String?
  createdAt             DateTime      @default(now())

  payment Payment @relation(fields: [paymentId], references: [id])
}
```

Notes:
- Receipt is a point-in-time snapshot. Business name and address are copied from BusinessSettings at generation time (not a FK) to preserve historical accuracy even if settings change later.
- receiptNumber auto-generated: "REC-" + zero-padded sequence
- Receipt records are IMMUTABLE after creation

Indexes:
- UNIQUE INDEX on receiptNumber
- UNIQUE INDEX on paymentId (one receipt per payment)

---

### AuditLog

```prisma
model AuditLog {
  id              String         @id @default(uuid())
  eventType       AuditEventType
  performedById   String
  performedByName String
  affectedModel   String
  affectedId      String
  beforeValue     Json?
  afterValue      Json?
  metadata        Json?
  createdAt       DateTime       @default(now())

  performedBy User @relation("AuditPerformedBy", fields: [performedById], references: [id])
}
```

Notes:
- APPEND-ONLY. No UPDATE or DELETE operations ever permitted.
- performedByName copied at log creation time for historical accuracy.
- affectedModel examples: "Loan", "Payment", "Customer", "User", "BusinessSettings"
- beforeValue / afterValue: JSON snapshot of changed fields (not full record to avoid bloat)
- metadata: additional context (e.g., AI query intent for AI_QUERY_EXECUTED events)

Indexes:
- INDEX on performedById
- INDEX on eventType
- INDEX on affectedModel
- INDEX on affectedId
- COMPOSITE INDEX on (affectedModel, affectedId)
- INDEX on createdAt (for date range queries)

---

### BusinessSettings

```prisma
model BusinessSettings {
  id                  String       @id @default("singleton")
  businessName        String
  businessAddress     String
  businessPhone       String?
  defaultMonthlyRateBps Int
  defaultInterestType InterestType @default(FLAT_MONTHLY)
  defaultTenureMonths Int          @default(3)
  currencySymbol      String       @default("Rs.")
  receiptFooterText   String?
  updatedAt           DateTime     @updatedAt
}
```

Notes:
- Singleton row: id = "singleton"
- Seeded with default values on first deployment
- Changes logged in AuditLog

---

### Notification (Future Scope — Schema Placeholder)

```prisma
model Notification {
  id         String   @id @default(uuid())
  userId     String?
  customerId String?
  loanId     String?
  type       String
  title      String
  body       String
  isRead     Boolean  @default(false)
  createdAt  DateTime @default(now())
}
```

---

## 5. Financial Data Rules

1. ALL monetary values stored in paise as BigInt. Never Decimal or Float for money.
2. Interest rates stored in basis points as Int. 1% per month = 100 bps. 2% = 200 bps.
3. Gold weight stored as Decimal(8,3) — grams with 3 decimal places.
4. Receipt copies business name/address at generation time — no FK to BusinessSettings.
5. Payment records are immutable after creation.
6. AuditLog records are immutable after creation.
7. Loan principalPaise is immutable after creation.
8. Loan monthlyRateBps is immutable after creation.
9. Outstanding calculations are always derived, never stored:
   - Outstanding Interest = SUM(accrued) - SUM(payment.interestAmountPaise)
   - Outstanding Principal = principalPaise - SUM(payment.principalAmountPaise)

---

## 6. Loan Number Generation

Loan numbers are auto-generated by the LoanService at creation time.

Format: GL-XXXX (zero-padded to 4 digits minimum)
Examples: GL-1001, GL-1002, GL-9999, GL-10000

Implementation:
- Query MAX(loanNumber) at creation time (or use a dedicated sequence)
- Parse the numeric suffix and increment
- Wrap in a transaction to prevent race conditions

---

## 7. Receipt Number Generation

Format: REC-XXXXX (zero-padded to 5 digits minimum)
Examples: REC-10001, REC-10002

Same generation pattern as loan numbers.

---

## 8. Migration Rules

- Never modify a migration file after it has been applied to any environment.
- Use `prisma migrate dev` in development (generates migration + applies it).
- Use `prisma migrate deploy` in production (applies pending migrations).
- Never use `prisma db push` in production.
- Always review generated SQL before deploying to production.
- Include seed data (owner account, default BusinessSettings) in a seed script, not in migrations.

---

## 9. Query Patterns

### Overdue Loans Query
```sql
SELECT * FROM "Loan"
WHERE "dueDate" < NOW()
  AND "status" NOT IN ('SETTLED', 'CLOSED')
ORDER BY "dueDate" ASC;
```

### Outstanding Calculation Per Loan
- Fetched via LoanService.getLoanWithOutstanding(loanId)
- Computes: SUM of payment.interestAmountPaise and SUM of payment.principalAmountPaise
- Calls InterestService.calculateAccruedInterest() with today as asOfDate
- Returns all outstanding values derived at query time

### Customer Search
```sql
SELECT * FROM "Customer"
WHERE "fullName" ILIKE '%search%'
   OR "mobileNumber" ILIKE '%search%'
   OR "idProofNumber" ILIKE '%search%'
ORDER BY "fullName" ASC;
```
