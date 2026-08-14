# GoldLoan AI — Product Requirements Document (PRD)

**Version:** 1.0
**Author:** Product Manager Agent
**Date:** 2026-08-13
**Status:** Draft — Awaiting Review

---

## Table of Contents

1. Product Vision
2. Problem Statement
3. Target Users
4. User Roles and Permissions
5. Core Modules
6. Functional Requirements
7. Business Workflows
8. Financial Business Rules
9. Non-Functional Requirements
10. User Stories
11. Acceptance Criteria
12. MVP Scope
13. Future Scope
14. Success Metrics
15. Open Decisions

---

## 1. Product Vision

GoldLoan AI is a production-ready gold loan and pawn shop management platform for small and medium-sized gold loan businesses.

The system replaces notebooks, spreadsheets, and manual calculations with a reliable, secure, and easy-to-use digital platform that manages the complete lifecycle of a gold loan — from customer registration through gold item pledging, loan disbursement, interest tracking, payment collection, and final settlement.

An AI assistant layer provides natural-language business intelligence on top of the operational data, allowing owners and authorized staff to query loan status, collections, and outstanding balances in plain language.

The product must be:
- Reliable — financial calculations must always be correct
- Secure — customer and financial data must be protected
- Simple — shop staff with minimal technical experience must be able to use it
- Auditable — every financial action must be traceable
- AI-augmented — business intelligence must be accessible through conversation

---

## 2. Problem Statement

Gold loan businesses in India — particularly small and medium shops — operate with significant manual overhead:

| Problem | Impact |
|---|---|
| Loans tracked in physical registers or spreadsheets | Data loss risk, errors, no search |
| Interest calculated manually or by calculator | Calculation errors, disputes |
| No systematic overdue tracking | Missed collections, revenue loss |
| Payment receipts written by hand | Forgery risk, no central history |
| No role separation | All staff see everything, audit trail missing |
| No consolidated reports | Owner cannot see business performance quickly |
| Customer information scattered | Duplicate records, missing KYC |
| Gold item records informal | Items lost or misidentified |

GoldLoan AI solves these problems by providing a structured, digitized, role-aware system with accurate automated calculations and an AI layer for business queries.

---

## 3. Target Users

### Primary Users

| User Type | Description | Technical Level |
|---|---|---|
| Business Owner | Runs the gold loan shop. Final authority on all operations. | Low to Medium |
| Shop Staff | Day-to-day operations — customer intake, payments, receipts. | Low |

**Owner:** Manages 1-5 staff. Handles 20-200 active loans. Needs daily summaries and overdue visibility. May access from desktop, tablet, or mobile.

**Staff:** Handles walk-ins and payment collection. Needs fast customer lookup. Works on shared desktop or mobile. Must not see business-wide reports.

### Secondary Users

| User Type | Description |
|---|---|
| Accountant | Periodic review of reports and transaction records |
| Auditor | Periodic review of audit logs and financial records |

---

## 4. User Roles and Permissions

### 4.1 Owner Role

The Owner has full system access.

| Capability | Owner |
|---|---|
| Create and manage staff accounts | Yes |
| Assign/revoke staff permissions | Yes |
| Create customers | Yes |
| View all customers | Yes |
| Create gold items | Yes |
| Create loans | Yes |
| View all loans | Yes |
| Record payments | Yes |
| View payment history | Yes |
| Generate receipts | Yes |
| View overdue loans | Yes |
| View all reports | Yes |
| View audit logs | Yes |
| Use AI assistant | Yes |
| Configure business settings | Yes |
| Close / settle loans | Yes |

### 4.2 Staff Role

Staff permissions are configured individually by the Owner. Default staff permissions are minimal.

| Capability | Staff Default | Configurable by Owner |
|---|---|---|
| Create customers | Yes | No (always allowed) |
| View own-created customers | Yes | No |
| View all customers | No | Yes |
| Create gold items | Yes | No |
| Create loans | No | Yes |
| View loans | Yes (limited) | Extends to all |
| Record payments | Yes | No |
| Generate receipts | Yes | No |
| View overdue loans | No | Yes |
| View reports | No | Yes |
| View audit logs | No | No |
| Use AI assistant | No | Yes |
| Configure settings | No | No |
| Manage staff | No | No |

**Rule:** Staff must never automatically receive owner-level permissions. Authorization is always enforced server-side.

---

## 5. Core Modules

```
Authentication
Users
Customers
Gold Items
Loans
Interest
Payments
Receipts
Reports
Notifications
Audit Logs
AI Assistant
Settings
```

---

## 6. Functional Requirements

### 6.1 Authentication and Session Management

**FR-AUTH-001:** Support email and password login.

**FR-AUTH-002:** Passwords must be hashed with bcrypt or argon2. Plaintext passwords never stored.

**FR-AUTH-003:** Issue JWT access token and refresh token on successful login.

**FR-AUTH-004:** Access tokens expire in 15 minutes. Refresh tokens expire in 7 days.

**FR-AUTH-005:** Support token refresh without re-login while refresh token is valid.

**FR-AUTH-006:** Invalidate sessions on logout.

**FR-AUTH-007:** After 5 consecutive login failures for the same account within 15 minutes, block further attempts temporarily.

**FR-AUTH-008:** All protected endpoints require valid JWT. Missing or invalid token returns HTTP 401.

**FR-AUTH-009:** Owner account created during initial setup. First login prompts password change if default password was used.

### 6.2 User Management

**FR-USER-001:** Owner can create, view, update, and deactivate staff accounts.

**FR-USER-002:** Each user account contains: full name, email, role, active status, created date.

**FR-USER-003:** Owner can assign granular permissions to each staff member.

**FR-USER-004:** A deactivated account cannot log in.

**FR-USER-005:** Deleting a user account is not permitted. Deactivation preserves audit history.

**FR-USER-006:** User creation, permission changes, and deactivation recorded in audit log.

**FR-USER-007:** Staff accounts cannot modify their own permissions.

### 6.3 Customer Management

**FR-CUST-001:** Create customer with: full name, mobile number (unique), address, ID proof type, ID proof number, date of birth (optional), photo (optional), ID document (optional).

**FR-CUST-002:** Customer mobile number must be unique system-wide.

**FR-CUST-003:** Search customers by name, mobile number, or ID proof number.

**FR-CUST-004:** Customer detail view shows all associated loans, gold items, and payment history.

**FR-CUST-005:** Customer records editable by Owner or Staff with permission.

**FR-CUST-006:** Customer records cannot be deleted if they have active or historical loans.

**FR-CUST-007:** Customer updates recorded in audit log.

**FR-CUST-008:** Customer list supports pagination.

### 6.4 Gold Item Management

**FR-GOLD-001:** Record gold item with: description, weight in grams, purity (18K/20K/22K/24K), estimated market value at pledge time, photo (optional), condition notes (optional).

**FR-GOLD-002:** Gold items linked to a specific customer and a specific loan.

**FR-GOLD-003:** A gold item can be associated with only one active loan at a time.

**FR-GOLD-004:** Gold item shows current status: Pledged / Released / Auctioned (future).

**FR-GOLD-005:** Gold item records cannot be deleted if linked to any loan.

**FR-GOLD-006:** Display summary of pledged gold for each loan.

### 6.5 Loan Management

**FR-LOAN-001:** A loan must be created against a specific customer.

**FR-LOAN-002:** Loan includes: auto-generated loan number, customer reference, principal amount, interest rate, interest type, start date, due date, tenure in months, gold items pledged, created-by user, status.

**FR-LOAN-003:** Loan number is unique and auto-generated. Not editable after creation.

**FR-LOAN-004:** Support part payments and full settlement.

**FR-LOAN-005:** Loan status updates automatically: Active becomes Overdue when due date passes. Active or Overdue becomes Settled when fully paid.

**FR-LOAN-006:** Loan detail shows: principal, interest rate, accrued interest to date, amounts paid, outstanding principal, outstanding interest, total outstanding, last payment date, status.

**FR-LOAN-007:** Support loan renewal/extension (rules in Open Decisions OD-009).

**FR-LOAN-008:** Loan creation recorded in audit log with all parameters.

**FR-LOAN-009:** Loan parameters (principal, interest rate, start date) are immutable after creation. Any modification requires an authorized action and audit log entry.

**FR-LOAN-010:** A customer can have multiple active loans simultaneously.

### 6.6 Interest Calculation

**FR-INT-001:** Support flat monthly interest:
```
Monthly Interest = (Principal x Monthly Rate) / 100
Interest for N complete months = Monthly Interest x N
Partial month behavior defined in Open Decision OD-005
```

**FR-INT-002:** Interest calculated by backend. Frontend displays but does not compute truth.

**FR-INT-003:** Track interest accrued separately from interest paid.

**FR-INT-004:** Outstanding interest = Total accrued interest minus interest paid.

**FR-INT-005:** Outstanding principal = Original principal minus principal repaid.

**FR-INT-006:** Total outstanding = Outstanding principal plus outstanding interest.

**FR-INT-007:** Interest accrued computed as of current date at query time (not stored as fixed value).

**FR-INT-008:** Use decimal-safe arithmetic. Store and compute in paise (integer). No floating-point for monetary values.

**FR-INT-009:** Per-annum rates converted to per-month rate consistently using configured method.

**FR-INT-010:** Penalty interest for overdue loans defined in OD-006.

### 6.7 Payment Collection

**FR-PAY-001:** Record a payment against an active or overdue loan.

**FR-PAY-002:** Payment record contains: loan reference, payment date, amount paid, payment type, payment method (Cash/UPI/Bank Transfer/Cheque), reference number (optional), recorded-by user, receipt reference.

**FR-PAY-003:** Payment allocation follows interest-first rule (see Business Rules).

**FR-PAY-004:** Payments recorded using a database transaction for consistency.

**FR-PAY-005:** Payments cannot be deleted. Corrections use a reversal workflow (OD-008).

**FR-PAY-006:** Partial payments reduce outstanding balance without marking loan as settled.

**FR-PAY-007:** Full settlement changes loan status to Settled and gold items to Released.

**FR-PAY-008:** Payment recording recorded in audit log.

**FR-PAY-009:** Payment history displayed per loan in chronological order.

### 6.8 Due and Overdue Tracking

**FR-DUE-001:** Flag a loan as Overdue when today is past the loan due date and loan is not Settled or Closed.

**FR-DUE-002:** Dashboard shows: count of loans due today, count of overdue loans, total outstanding, total interest outstanding.

**FR-DUE-003:** Dedicated Overdue Loans screen showing: customer name, loan number, principal, days overdue, outstanding amount.

**FR-DUE-004:** Dashboard shows loans due in the next 7 days.

**FR-DUE-005:** Overdue status computed server-side. Does not rely solely on a scheduled job.

**FR-DUE-006:** Notifications for overdue loans are Future Scope.

### 6.9 Receipts

**FR-REC-001:** Generate printable or downloadable receipt after recording a payment.

**FR-REC-002:** Receipt contains: business name and address, receipt number, payment date, customer name and mobile, loan number, amount paid, payment method, outstanding balance after payment, recorded-by name, signature area.

**FR-REC-003:** Receipt available as PDF or print-friendly HTML.

**FR-REC-004:** Receipt linked to exactly one payment record.

**FR-REC-005:** Receipts viewable from payment history after generation.

**FR-REC-006:** Receipts are not editable after generation.

### 6.10 Reports

**FR-REP-001:** Owner-accessible reports:

| Report | Description |
|---|---|
| Daily Collection Report | Total payments collected on a given date |
| Monthly Collection Report | Total payments in a month broken down by day |
| Outstanding Loans Report | All active loans with outstanding amounts |
| Overdue Loans Report | All overdue loans with days overdue |
| Interest Income Report | Total interest collected in a period |
| Loan Summary Report | Total loans disbursed, total principal, total outstanding |
| Customer Ledger | Full transaction history for a specific customer |

**FR-REP-002:** Reports filterable by date range.

**FR-REP-003:** Reports viewable on screen and exportable to CSV or PDF.

**FR-REP-004:** Report data reflects real-time database state.

**FR-REP-005:** Reports accessible by Owner or Staff with explicit report permission only.

### 6.11 Audit Logs

**FR-AUD-001:** Immutable audit log for: User Created, User Deactivated, User Permission Changed, Customer Created, Customer Updated, Gold Item Created, Gold Item Updated, Loan Created, Loan Updated, Loan Settled, Loan Closed, Payment Recorded, Receipt Generated, Settings Changed, AI Query Executed.

**FR-AUD-002:** Each audit entry records: event type, performed by (ID and name), timestamp (UTC), affected record ID and type, before value, after value.

**FR-AUD-003:** Audit logs not deletable by any user including Owner.

**FR-AUD-004:** Audit logs searchable by event type, user, date range, record ID.

**FR-AUD-005:** Audit logs viewable by Owner only.

### 6.12 AI Assistant

**FR-AI-001:** Natural-language AI assistant accessible from a dedicated chat interface.

**FR-AI-002:** AI answers business queries using real application data via authorized backend tools.

**FR-AI-003:** AI must NOT invent financial data. If data not found, say so explicitly.

**FR-AI-004:** Initial supported queries: overdue loans, due loans, outstanding balances, collection summaries, loan search by amount or customer, customer search, interest income queries.

**FR-AI-005:** AI respects the same authorization rules as the rest of the system.

**FR-AI-006:** AI is READ-ONLY in MVP. Cannot create, modify, or delete any records.

**FR-AI-007:** Ambiguous queries prompt clarification, not guessing.

**FR-AI-008:** AI treats retrieved database content as untrusted data (prompt injection defense).

**FR-AI-009:** AI uses deterministic backend calculations for financial values. LLM arithmetic not used for financial summaries.

**FR-AI-010:** AI accessible to Owner by default. Staff access requires explicit Owner permission.

### 6.13 Business Settings

**FR-SET-001:** Owner configures: business name, address, phone number, default interest rate, default interest type, default tenure, currency symbol, receipt footer text.

**FR-SET-002:** Settings changes recorded in audit log.

**FR-SET-003:** Default settings pre-fill new loan forms. Overridable per loan.

---

## 7. Business Workflows

### 7.1 New Customer and New Loan

```
Owner or Staff
  -> Register Customer (Name, Mobile, ID Proof)
  -> Add Gold Items (Description, Weight, Purity, Value)
  -> Create Loan (Principal, Rate, Tenure, Start Date)
  -> System calculates due date
  -> Loan record created (Status: Active)
  -> Audit log: Loan Created
  -> Loan details shown to user
```

### 7.2 Payment Collection

```
Customer walks in
  -> Staff searches customer by name or mobile
  -> Staff opens loan details
  -> System shows outstanding principal + interest + total
  -> Staff enters payment amount and method
  -> System allocates: interest first, then principal
  -> Payment saved (database transaction)
  -> If fully settled: Loan = Settled, Gold Items = Released
  -> Audit log: Payment Recorded
  -> Receipt generated
```

### 7.3 Overdue Loan Review

```
Owner opens Overdue Loans screen
  -> System lists all overdue loans with outstanding amounts
  -> Owner selects a loan
  -> Owner views loan details and payment history
  -> If customer pays: Payment Collection Workflow
```

### 7.4 AI Query

```
User types natural-language query
  -> Backend AI service receives query
  -> AI selects appropriate backend tool
  -> Tool calls authorized backend service
  -> Backend service returns real data
  -> AI formats response
  -> User sees answer based on real database data
```

---

## 8. Financial Business Rules

**BR-FIN-001: Payment Allocation Order**
1. Outstanding interest first
2. Outstanding principal second

Example: Outstanding interest Rs. 3,000, outstanding principal Rs. 50,000, payment Rs. 5,000.
Allocation: Rs. 3,000 to interest (cleared), Rs. 2,000 to principal (reduced to Rs. 48,000).

**BR-FIN-002: Flat Monthly Interest**
```
Monthly Interest = (Principal x Monthly Rate) / 100
Interest for N complete months = Monthly Interest x N
Partial month calculation governed by OD-005
```

**BR-FIN-003:** Outstanding Interest = Total Accrued Interest - Interest Paid

**BR-FIN-004:** Outstanding Principal = Original Principal - Total Principal Paid

**BR-FIN-005:** Total Outstanding = Outstanding Principal + Outstanding Interest

**BR-FIN-006: Loan Due Date**
```
Due Date = Loan Start Date + Tenure (months)
```

**BR-FIN-007: Overdue Classification**
A loan is Overdue when: Today > Loan Due Date AND status is not Settled AND status is not Closed.

**BR-FIN-008: Full Settlement**
A loan is Settled when: Total Amount Paid >= Outstanding Principal + Outstanding Interest.
On settlement: Loan Status = Settled, all linked Gold Items = Released.

**BR-FIN-009:** Minimum payment is Rs. 1 (100 paise). Zero or negative payments rejected.

**BR-FIN-010: Currency Representation**
All monetary values stored and computed in paise (BigInt integer). Display in rupees with two decimal places.

**BR-FIN-011:** Penalty interest rules defined in OD-006.

**BR-FIN-012:** Part payment: amount less than total outstanding, loan remains Active or Overdue. Full settlement: amount covers total outstanding, loan moves to Settled.

**BR-FIN-013:** Reducing balance interest is Future Scope (OD-007).

---

## 9. Non-Functional Requirements

### Performance
| Requirement | Target |
|---|---|
| Page load (first meaningful content) | Under 2 seconds |
| API response (standard reads) | Under 500ms |
| API response (reports) | Under 3 seconds |
| AI response | Under 10 seconds (streaming preferred) |

### Security
- All data in transit encrypted via HTTPS/TLS
- Passwords never stored in plaintext
- JWT secrets in environment variables only
- API keys never exposed to frontend
- All financial endpoints authorization-checked server-side
- Backend validation authoritative regardless of frontend validation

### Usability
- Usable by non-technical shop staff
- Core workflows complete in 3 steps or fewer
- All forms have clear labels, validation messages, success/error feedback
- Responsive on mobile browser

### Data Integrity
- Financial records never silently overwritten
- Multi-step financial operations use database transactions
- Orphaned records prevented by database constraints

### Auditability
- Every financial mutation has an audit log entry
- Audit logs tamper-proof from application layer

### Scalability
- MVP supports up to 200 concurrent active loans without degradation
- Designed to scale beyond this with infrastructure changes, not code rewrites

---

## 10. User Stories

**US-001:** As a user, I want to log in with email and password so I can access the system securely.
**US-002:** As a user, I want automatic logout when my session expires so my account is protected.
**US-003:** As an owner, I want failed login attempts limited to prevent brute-force attacks.
**US-004:** As an owner, I want to create staff accounts so employees can log in.
**US-005:** As an owner, I want to assign specific permissions to each staff member.
**US-006:** As an owner, I want to deactivate staff accounts when employees leave.
**US-007:** As a staff member, I want to register a new customer with name, mobile, and ID proof.
**US-008:** As a staff member, I want to search customers by name or mobile number quickly.
**US-009:** As an owner, I want to view a customer's full history from a single screen.
**US-010:** As a staff member, I want to upload customer photo and ID document for digital KYC.
**US-011:** As a staff member, I want to record details of gold items a customer is pledging.
**US-012:** As an owner, I want to see all gold items linked to a loan.
**US-013:** As an owner, I want gold items automatically marked Released when a loan is settled.
**US-014:** As a staff member with permission, I want to create a new loan with principal, rate, tenure.
**US-015:** As an owner, I want every loan to have a unique auto-generated loan number.
**US-016:** As an owner, I want to view full loan details including outstanding amounts as of today.
**US-017:** As a staff member, I want to see the current outstanding balance before recording a payment.
**US-018:** As an owner, I want interest calculated automatically from the loan start date and rate.
**US-019:** As an owner, I want interest calculated on the backend so I can trust the numbers.
**US-020:** As a staff member, I want outstanding interest to update daily without manual intervention.
**US-021:** As a staff member, I want to record a payment specifying amount and payment method.
**US-022:** As a staff member, I want the system to allocate payment to interest first then principal.
**US-023:** As an owner, I want the system to automatically mark a loan as Settled when balance is zero.
**US-024:** As an owner, I want every payment recorded with who collected it and when.
**US-025:** As an owner, I want to see all overdue loans on a dedicated screen.
**US-026:** As an owner, I want my dashboard to show loans due today and loans already overdue.
**US-027:** As an owner, I want to see how many days each overdue loan is past its due date.
**US-028:** As a staff member, I want to generate a receipt immediately after recording a payment.
**US-029:** As a customer, I want a receipt showing what I paid and what remains outstanding.
**US-030:** As an owner, I want receipts to include my business name and address from settings.
**US-031:** As an owner, I want a daily collection report showing all payments received on a given date.
**US-032:** As an owner, I want to see total outstanding across all active loans.
**US-033:** As an owner, I want to export reports to CSV or PDF for accounting.
**US-034:** As an owner, I want a customer ledger showing all their transactions.
**US-035:** As an owner, I want a log of every loan creation, payment, and modification with the user who performed it.
**US-036:** As an owner, I want the audit log to be read-only so no one can tamper with it.
**US-037:** As an owner, I want to ask natural-language questions and get answers from the real database.
**US-038:** As an owner, I want to ask "how much interest was collected this month?" and get the correct total.
**US-039:** As an owner, I want the AI to tell me clearly if it cannot find data, not make up answers.
**US-040:** As an owner, I want the AI to ask for clarification when my question is ambiguous.
**US-041:** As an owner, I want to enter my business name and address so it appears on all receipts.
**US-042:** As an owner, I want to set a default interest rate that pre-fills when creating a new loan.

---

## 11. Acceptance Criteria

**AC-AUTH-001: Successful Login**
GIVEN a valid email and password
WHEN the user submits the login form
THEN a valid JWT access token and refresh token are issued
AND the user is redirected to the Dashboard

**AC-AUTH-002: Failed Login**
GIVEN an invalid email or password
WHEN the user submits the login form
THEN the response is "Invalid credentials"
AND no token is issued

**AC-CUST-001: Customer Registration — Success**
GIVEN required fields are provided
WHEN a staff member submits the registration form
THEN a customer record is created
AND the customer is searchable by name and mobile
AND an audit log entry is created

**AC-CUST-002: Customer Registration — Duplicate Mobile**
GIVEN a mobile number that already exists
WHEN the form is submitted
THEN the system rejects with "Mobile number already registered"
AND no duplicate customer is created

**AC-LOAN-001: Loan Creation**
GIVEN a customer exists
WHEN an authorized user creates a loan with principal, rate, tenure, start date
THEN a loan record is created with auto-generated loan number
AND status is Active
AND outstanding equals principal
AND due date is correctly calculated
AND an audit log entry is created

**AC-INT-001: Interest Calculation — Full Months**
GIVEN a loan of Rs. 1,00,000 at 2% per month
WHEN 3 complete months have passed
THEN accrued interest is Rs. 6,000
AND total outstanding is Rs. 1,06,000

**AC-PAY-001: Payment Allocation**
GIVEN outstanding interest Rs. 3,000 and outstanding principal Rs. 50,000
WHEN a payment of Rs. 5,000 is recorded
THEN Rs. 3,000 is allocated to interest (cleared)
AND Rs. 2,000 is allocated to principal (reduced to Rs. 48,000)
AND a receipt can be generated
AND an audit log entry is created

**AC-PAY-002: Full Settlement**
GIVEN total outstanding Rs. 52,000
WHEN a payment of Rs. 52,000 or more is recorded
THEN loan status changes to Settled
AND all linked gold items change to Released
AND an audit log entry is created

**AC-OVER-001: Overdue Detection**
GIVEN a loan with due date 1 Aug 2026 and status Active
WHEN the system is queried on 2 Aug 2026
THEN the loan appears in overdue loans list
AND status shows Overdue
AND days overdue shows 1

**AC-REC-001: Receipt Generation**
GIVEN a payment has been recorded
WHEN the user requests a receipt
THEN a receipt is generated with: business name, receipt number, date, customer name, loan number, amount paid, payment method, outstanding balance after payment
AND the receipt is printable or downloadable as PDF
AND the receipt cannot be modified

**AC-AI-001: AI Accuracy — Real Data**
GIVEN the database contains 3 overdue loans
WHEN the owner asks "show me all overdue loans"
THEN the AI returns exactly 3 loans with correct details
AND data matches the overdue loans screen

**AC-AI-002: AI — No Hallucination**
GIVEN no customer named John exists
WHEN the owner asks "what is John's loan balance?"
THEN the AI responds "I could not find a customer named John"
AND does not invent any financial data

**AC-AUD-001: Audit Log — Loan Created**
GIVEN the owner creates a loan
WHEN the owner views the audit log
THEN an entry exists with: event = Loan Created, user name, timestamp, loan number

**AC-AUD-002: Audit Log — Access Control**
GIVEN a staff user without audit log permission
WHEN they attempt to view audit logs
THEN the system returns HTTP 403

---

## 12. MVP Scope

### In Scope

| Priority | Feature |
|---|---|
| P0 | Authentication (login, logout, JWT, roles) |
| P0 | Owner and Staff user management |
| P0 | Customer creation, search, view |
| P0 | Gold item creation and linking to loans |
| P0 | Loan creation with principal, rate, tenure, due date |
| P0 | Flat monthly interest calculation (backend) |
| P0 | Payment recording with interest-first allocation |
| P0 | Outstanding balance display (real-time) |
| P0 | Loan status: Active / Overdue / Settled |
| P0 | Overdue loans screen |
| P0 | Dashboard with summary counts and upcoming dues |
| P0 | Receipt generation (PDF or printable HTML) |
| P0 | Audit logging for all financial actions |
| P1 | Daily collection report |
| P1 | Outstanding loans report |
| P1 | Overdue loans report |
| P1 | Business settings (name, address, default rate) |
| P1 | AI assistant — read-only natural-language queries |
| P1 | Staff permissions management by Owner |
| P2 | Customer ledger report |
| P2 | CSV / PDF export for reports |
| P2 | Customer photo and ID document upload |
| P2 | Gold item photo upload |

P0 = Must have for MVP launch
P1 = Should have for MVP launch
P2 = Nice to have in MVP, can ship shortly after

---

## 13. Future Scope

| Feature | Reason Deferred |
|---|---|
| SMS / WhatsApp notifications | Third-party integration complexity |
| Reducing balance interest | Flat rate covers most shops for MVP |
| Penalty interest on overdue loans | Business rules unclear — OD-006 |
| Loan auction / forfeiture workflow | Complex legal workflow |
| Multiple branch support | Not needed for single-shop MVP |
| Customer mobile app | Out of scope for MVP |
| Payment gateway integration | Manual collection sufficient for MVP |
| Payment reversal / correction | Requires policy decisions — OD-008 |
| AI write actions | Needs explicit authorized workflow design |
| Loan renewal / extension | Needs business rule clarity — OD-009 |
| Bulk import from spreadsheet | Migration tool, not core product |
| Two-factor authentication | Good to have, not P0 |
| Accountant read-only role | Can be added as third role later |
| Customer-facing portal | Future product extension |
| Real-time gold rate API integration | Market rate lookup |

---

## 14. Success Metrics

| Metric | Target for MVP |
|---|---|
| Interest calculation error rate | 0% on all tested scenarios |
| Payment recording success rate | 100% (no lost payments) |
| Outstanding balance accuracy | Exact match with manual calculation |
| Overdue loan detection accuracy | 100% (no missed overdue loans) |
| Audit log coverage | 100% of defined financial events |
| AI hallucination rate | 0% on all tested query scenarios |
| Steps to record a payment | 3 or fewer from Dashboard |
| System uptime | 99.5% or above |
| Receipt generation success rate | 100% |
| Time to onboard a new customer | Under 5 minutes |
| Time to record a payment | Under 2 minutes |

---

## 15. Open Decisions

Do not silently assume answers. Document resolutions here when decided.

| ID | Question | Affected Features | Status |
|---|---|---|---|
| OD-001 | What happens when a customer has multiple active loans? | Loan Management, Reports, AI | **Decided: Each loan is independent. Customer can have multiple active loans.** |
| OD-002 | Is there a maximum loan amount per business? | Loan Creation | Unresolved |
| OD-003 | Can staff create a loan without owner approval? | Loan Creation, Permissions | Unresolved — current design: Owner configures per staff member |
| OD-004 | Should a loan auto-close after settlement or remain Settled indefinitely? | Loan Lifecycle | Unresolved |
| OD-005 | How is partial-month interest calculated? (a) 30-day proration (b) actual days proration (c) full month if any day used | Interest Calculation | **MUST be decided before implementing interest calculation** |
| OD-006 | Is penalty interest charged on overdue loans? Rate and start timing? | Overdue Loans, Interest | Unresolved |
| OD-007 | Reducing balance interest in MVP? | Interest Calculation | **Decided: No. Flat rate only in MVP.** |
| OD-008 | Payment correction/reversal policy? Who approves? Counter-entry used? | Payments, Audit | Unresolved — reversals out of MVP scope |
| OD-009 | How does loan renewal/extension work? New loan or extend existing? What happens to accrued interest? | Loan Lifecycle | Unresolved |
| OD-010 | Minimum loan tenure or minimum principal enforced? | Loan Creation | Unresolved |
| OD-011 | Should receipt include gold item description or only payment details? | Receipts | Unresolved |
| OD-012 | Payment methods required from day one? | Payments | **Decided: Cash, UPI, Bank Transfer, Cheque all required.** |
| OD-013 | AI assistant scope in MVP — Owner only or also configurable for staff? | AI Assistant, Permissions | **Decided: Owner only by default. Owner can grant to individual staff.** |
| OD-014 | Gold purity standards supported — 18K/20K/22K/24K only or also hallmark? | Gold Item Management | Unresolved |
| OD-015 | KYC approval workflow required before loan creation? | Customer Management | Unresolved |

---

*End of PRD v1.0*
