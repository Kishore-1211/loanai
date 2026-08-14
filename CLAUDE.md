# GoldLoan AI

## 1. Project Overview

GoldLoan AI is a production-ready gold loan and pawn shop management platform designed for small and medium-sized gold loan businesses.

The system must help business owners and staff manage:

* Customers
* Gold items pledged as collateral
* Gold loans
* Interest calculations
* Payments and collections
* Due dates and overdue loans
* Receipts and transaction history
* Staff access and permissions
* Business reports
* AI-powered business queries

The goal is to replace notebooks, spreadsheets, and manual calculations with a reliable digital system.

---

# 2. Core Product Principle

Build the application as a real business product, not as a demo.

Every feature must be:

* Reliable
* Secure
* Testable
* Maintainable
* Responsive
* Easy for non-technical shop staff to use

Do not implement fake functionality, placeholder buttons, mock APIs, or incomplete flows unless explicitly required during prototyping.

When a requirement is unclear, inspect the existing project documentation and code before making assumptions.

---

# 3. Technology Stack

## Frontend

* Next.js
* TypeScript
* Tailwind CSS
* React
* Modern component architecture

## Backend

* NestJS
* TypeScript
* REST API
* JWT authentication
* Role-based authorization

## Database

* PostgreSQL
* Prisma ORM

## Storage

* Supabase Storage for customer/gold-item images and documents

## AI

Use an LLM API for natural-language business queries.

The AI layer must never directly modify financial records without explicit authorization and validation.

## Development

* Git
* Docker where appropriate
* Environment variables for secrets
* ESLint
* Prettier
* Automated tests

---

# 4. User Roles

The application initially supports:

## Owner

Can:

* Create and manage staff
* Create customers
* Create loans
* View all loans
* Record payments
* View reports
* View overdue loans
* Use AI assistant
* View audit logs
* Configure business settings

## Staff

Can:

* Create customers
* View assigned customers
* Create loans if permission is granted
* Record payments
* View loan information
* Generate receipts

Staff must not automatically receive owner-level permissions.

Always enforce authorization on the backend.

---

# 5. Core Modules

The system must be organized into these modules:

```text
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

# 6. Core Business Entities

At minimum, the database should contain:

```text
User
Customer
GoldItem
Loan
Payment
Receipt
AuditLog
Notification
BusinessSettings
```

Relationships must be properly designed.

Example:

```text
Customer
   |
   └── Loans
          |
          ├── GoldItems
          |
          └── Payments
```

Never duplicate important financial data unnecessarily.

---

# 7. Financial Accuracy Rules

Financial calculations are critical.

Interest calculations must be implemented in a dedicated and testable business-logic layer.

Never calculate important financial values only in the frontend.

The backend is the source of truth.

Every monetary amount must:

* Use decimal-safe representation
* Avoid floating-point errors
* Store currency values consistently
* Be validated before saving

Do not silently round financial values.

The system must explicitly define:

* Principal amount
* Interest rate
* Interest type
* Start date
* Due date
* Payment date
* Outstanding principal
* Outstanding interest
* Total outstanding

Business rules must come from documented requirements, not assumptions.

---

# 8. Security Rules

Security is mandatory.

Implement:

* Secure password handling
* JWT authentication
* Role-based access control
* Input validation
* API authorization
* Rate limiting where appropriate
* Secure environment variables
* Protection against SQL injection
* Protection against unauthorized resource access
* Audit logging for important financial operations

Never hardcode:

* API keys
* Passwords
* Database credentials
* JWT secrets
* Private tokens

Never expose secrets to the frontend.

---

# 9. AI Assistant Rules

The AI assistant is a business intelligence interface, not the source of truth.

Examples of supported queries:

```text
Show overdue loans.

Which customers have unpaid interest?

How much interest was collected this month?

Show loans above ₹1,00,000.

Which loans are due this week?

How much is currently outstanding?
```

The AI must retrieve information from trusted backend/database tools.

The AI must not invent financial information.

Every financial answer should be traceable to actual database records.

For sensitive operations:

```text
AI should explain.
Backend should validate.
Authorized user should confirm.
Backend should execute.
```

The AI must not autonomously:

* Delete loans
* Delete customers
* Change principal amounts
* Change interest rates
* Mark payments as completed
* Forgive debt
* Modify financial records

without an explicit authorized workflow.

---

# 10. Architecture Rules

Use clear separation of concerns.

```text
Frontend
   ↓
API
   ↓
Controllers
   ↓
Services
   ↓
Business Logic
   ↓
Database
```

Do not put business logic directly inside controllers.

Do not put database queries directly inside frontend components.

Use services/repositories appropriately.

Keep modules independent and maintainable.

---

# 11. Frontend Rules

The UI should be designed for shop staff who may not be highly technical.

Prioritize:

* Simple navigation
* Large readable text
* Clear labels
* Minimal unnecessary steps
* Mobile responsiveness
* Fast forms
* Clear financial summaries
* Confirmation before destructive operations

Important screens:

```text
Login
Dashboard
Customers
Customer Details
Create Loan
Loan Details
Payment Collection
Receipts
Overdue Loans
Reports
AI Assistant
Staff Management
Settings
```

Every screen must include appropriate:

* Loading state
* Empty state
* Error state
* Success feedback

---

# 12. Backend Rules

Every API must include:

* Input validation
* Authorization
* Error handling
* Appropriate HTTP status codes
* Logging where necessary
* Tests for important business logic

Use consistent API response structures.

Do not expose internal database implementation details unnecessarily.

---

# 13. Database Rules

Database migrations must be used.

Never manually modify production schema without a migration.

Use:

* Foreign keys
* Proper indexes
* Unique constraints
* Appropriate nullable/non-nullable fields
* Created/updated timestamps

Financial records should be designed to preserve historical accuracy.

Do not overwrite historical transaction information when an audit/history record is required.

---

# 14. Auditability

Important operations must be logged.

Examples:

```text
Loan Created
Payment Recorded
Loan Updated
Interest Rate Changed
Customer Updated
User Created
User Permission Changed
```

Audit logs should capture:

```text
Who
What
When
Affected Record
Relevant Change
```

Do not allow normal users to silently delete audit history.

---

# 15. Testing Requirements

Write tests for critical functionality.

At minimum:

### Unit Tests

* Interest calculation
* Outstanding balance calculation
* Due-date calculation
* Payment calculation
* Authorization rules

### Integration Tests

* Customer creation
* Loan creation
* Payment creation
* Authentication
* AI data retrieval

### End-to-End Tests

Test major flows such as:

```text
Login
→ Create Customer
→ Create Loan
→ Record Payment
→ View Outstanding
→ Generate Receipt
```

Do not consider a feature complete until its critical path has been tested.

---

# 16. Development Workflow

Always follow:

```text
Understand
↓
Plan
↓
Implement
↓
Test
↓
Review
↓
Fix
↓
Verify
```

Before changing existing code:

1. Read relevant files.
2. Understand existing architecture.
3. Identify dependencies.
4. Make the smallest safe change.
5. Run tests.
6. Check for regressions.

Do not rewrite working systems unnecessarily.

---

# 17. Agent Workflow

Claude should operate using specialized roles.

## Product Manager

Creates:

```text
docs/PRD.md
```

Responsible for:

* Requirements
* User stories
* MVP scope
* Acceptance criteria

## Architect

Creates:

```text
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SPEC.md
```

Responsible for:

* System design
* Database design
* API design
* Security architecture

## Backend Engineer

Responsible for:

* Backend implementation
* Database integration
* Business logic
* APIs
* Authentication
* Tests

## Frontend Engineer

Responsible for:

* UI
* Forms
* Dashboard
* API integration
* UX

## QA Engineer

Responsible for:

* Testing
* Bug discovery
* Security review
* Business-rule validation

## AI Engineer

Responsible for:

* AI assistant
* Tool calling
* Retrieval
* Prompt design
* Guardrails
* AI evaluation

---

# 18. Review Loop

Every major feature must go through:

```text
Implement
↓
Run Tests
↓
QA Review
↓
Bug Fixes
↓
Run Tests Again
↓
Security Review
↓
Final Verification
```

Do not mark a feature complete merely because the code compiles.

A feature is complete only when:

```text
Requirements satisfied
+
Tests passing
+
Authorization verified
+
Error handling verified
+
UI flow verified
+
Documentation updated
```

---

# 19. Task Management

Maintain:

```text
docs/TASKS.md
```

Use:

```text
TODO
IN PROGRESS
BLOCKED
DONE
```

Each task should contain:

```text
Task
Owner/Agent
Requirements
Acceptance Criteria
Status
```

Do not work on unrelated features simultaneously when doing a focused sprint.

---

# 20. Documentation

Keep documentation synchronized with implementation.

Update documentation when:

* Architecture changes
* APIs change
* Database schema changes
* Business rules change
* AI capabilities change
* New modules are added

---

# 21. Coding Standards

Write:

* Clean TypeScript
* Small reusable functions
* Meaningful names
* Strong typing
* Minimal duplication
* Clear error handling
* Maintainable modules

Avoid:

* `any` unless genuinely necessary
* Huge components
* Huge service classes
* Hardcoded business rules
* Magic numbers
* Dead code
* Duplicate logic
* Temporary hacks

Comments should explain why something exists, not simply repeat what the code does.

---

# 22. Git Rules

Use meaningful commits.

Examples:

```text
feat: add customer management
feat: add loan creation
feat: add payment tracking
feat: add AI loan queries
fix: correct interest calculation
test: add loan calculation tests
```

Do not commit:

```text
.env
API keys
Passwords
Secrets
Local database files
```

---

# 23. MVP Definition

The first production MVP should prioritize:

```text
1. Authentication
2. Customer Management
3. Gold Item Management
4. Loan Creation
5. Interest Calculation
6. Payment Recording
7. Outstanding Balance
8. Due/Overdue Loans
9. Basic Reports
10. Audit Logs
```

AI features come after the financial workflow is reliable.

Initial AI capabilities:

```text
Natural-language loan search
Overdue loan queries
Interest collection summaries
Outstanding balance summaries
Due-date queries
```

---

# 24. Important Development Principle

Never optimize for "more AI agents."

Optimize for:

```text
Correctness
Reliability
Business Value
Security
User Experience
```

Agents are tools for building the product.

The product itself is the priority.

---

# 25. Definition of Done

Before declaring GoldLoan AI ready for users, verify:

```text
[ ] Authentication works
[ ] Authorization works
[ ] Customer management works
[ ] Gold item management works
[ ] Loan creation works
[ ] Interest calculation is verified
[ ] Payment recording works
[ ] Outstanding calculations are correct
[ ] Due/overdue logic works
[ ] Receipts work
[ ] Reports work
[ ] Audit logs work
[ ] AI answers use real database data
[ ] AI does not hallucinate financial data
[ ] Critical tests pass
[ ] Security review passes
[ ] Responsive UI works
[ ] Error states are handled
[ ] Documentation is updated
[ ] Production environment variables are configured
[ ] Deployment succeeds
```

When implementing any feature, first inspect the existing project and documentation, then make a focused change, test it, and verify that it satisfies the acceptance criteria.
