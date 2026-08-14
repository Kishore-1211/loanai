# GoldLoan AI — API Specification

**Version:** 1.0
**Author:** Architect Agent
**Date:** 2026-08-13

---

## 1. Overview

| Property | Value |
|---|---|
| Base URL | /api/v1 |
| Protocol | HTTPS only |
| Format | application/json |
| Authentication | Bearer JWT in Authorization header |
| Authorization | Role-based + permission-based, enforced server-side |

---

## 2. Standard Response Envelopes

### Success (single resource or action)
```json
{
  "success": true,
  "data": { }
}
```

### Success (paginated list)
```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error
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

---

## 3. HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | OK — request succeeded |
| 201 | Created — resource created |
| 400 | Bad Request — validation error |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — insufficient permissions |
| 404 | Not Found — resource does not exist |
| 409 | Conflict — duplicate resource |
| 422 | Unprocessable Entity — business rule violation |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error — unexpected server error |

---

## 4. Authentication Endpoints

### POST /api/v1/auth/login

Authenticate a user and issue tokens.

- Auth required: No
- Rate limit: 10 requests per minute per IP

**Request:**
```json
{
  "email": "owner@shop.com",
  "password": "SecurePass123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": "uuid",
      "email": "owner@shop.com",
      "fullName": "Shop Owner",
      "role": "OWNER",
      "permissions": []
    }
  }
}
```

Note: Refresh token set as httpOnly Secure SameSite=Strict cookie. Not in response body.

**Errors:**
- 400: Missing email or password
- 401: Invalid credentials
- 429: Too many failed attempts

---

### POST /api/v1/auth/refresh

Issue a new access token using the refresh token cookie.

- Auth required: No (reads httpOnly cookie)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9..."
  }
}
```

**Errors:**
- 401: Missing, invalid, or expired refresh token

---

### POST /api/v1/auth/logout

Invalidate the current session.

- Auth required: Yes

**Response 200:**
```json
{
  "success": true,
  "data": { "message": "Logged out successfully" }
}
```

---

## 5. User Endpoints

### GET /api/v1/users

List all user accounts.

- Auth required: Yes
- Permission: OWNER role only

**Query params:**
- isActive: boolean (default: true)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "staff@shop.com",
      "fullName": "Staff Member",
      "role": "STAFF",
      "permissions": ["CREATE_CUSTOMER", "RECORD_PAYMENT"],
      "isActive": true,
      "createdAt": "2026-08-01T00:00:00Z"
    }
  ]
}
```

---

### POST /api/v1/users

Create a new staff account.

- Auth required: Yes
- Permission: OWNER role only

**Request:**
```json
{
  "email": "newstaff@shop.com",
  "password": "TempPassword123",
  "fullName": "New Staff",
  "permissions": ["CREATE_CUSTOMER", "RECORD_PAYMENT"]
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "newstaff@shop.com",
    "fullName": "New Staff",
    "role": "STAFF",
    "permissions": ["CREATE_CUSTOMER", "RECORD_PAYMENT"],
    "isActive": true
  }
}
```

**Errors:**
- 400: Validation error (weak password, invalid email)
- 409: Email already registered

---

### GET /api/v1/users/:id

Get a specific user.

- Auth required: Yes
- Permission: OWNER role only

**Response 200:** User object (same shape as list item)

**Errors:**
- 404: User not found

---

### PATCH /api/v1/users/:id

Update user name or active status.

- Auth required: Yes
- Permission: OWNER role only

**Request (partial):**
```json
{
  "fullName": "Updated Name",
  "isActive": false
}
```

**Response 200:** Updated user object

**Errors:**
- 400: Validation error
- 404: User not found

---

### PATCH /api/v1/users/:id/permissions

Update a staff member's permissions.

- Auth required: Yes
- Permission: OWNER role only

**Request:**
```json
{
  "permissions": ["CREATE_CUSTOMER", "RECORD_PAYMENT", "VIEW_OVERDUE_LOANS"]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "permissions": ["CREATE_CUSTOMER", "RECORD_PAYMENT", "VIEW_OVERDUE_LOANS"]
  }
}
```

**Errors:**
- 400: Invalid permission value
- 403: Cannot modify own permissions
- 404: User not found

---

## 6. Customer Endpoints

### GET /api/v1/customers

List customers with search and pagination.

- Auth required: Yes
- Permission: VIEW_ALL_CUSTOMERS (or Owner)

**Query params:**
- search: string (matches fullName, mobileNumber, idProofNumber via ILIKE)
- page: number (default: 1)
- pageSize: number (default: 20, max: 100)
- isActive: boolean

**Response 200:** Paginated list of customers

---

### POST /api/v1/customers

Create a new customer.

- Auth required: Yes
- Permission: CREATE_CUSTOMER

**Request:**
```json
{
  "fullName": "Ravi Kumar",
  "mobileNumber": "9876543210",
  "address": "123 Main Street, Chennai, Tamil Nadu",
  "idProofType": "AADHAAR",
  "idProofNumber": "1234-5678-9012",
  "dateOfBirth": "1985-06-15"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fullName": "Ravi Kumar",
    "mobileNumber": "9876543210",
    "address": "123 Main Street, Chennai, Tamil Nadu",
    "idProofType": "AADHAAR",
    "idProofNumber": "1234-5678-9012",
    "isActive": true,
    "createdAt": "2026-08-13T10:00:00Z"
  }
}
```

**Errors:**
- 400: Validation error (missing required fields)
- 409: Mobile number already registered

---

### GET /api/v1/customers/:id

Get customer details with loans and gold items.

- Auth required: Yes
- Permission: VIEW_ALL_CUSTOMERS or created-by-self

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fullName": "Ravi Kumar",
    "mobileNumber": "9876543210",
    "address": "...",
    "idProofType": "AADHAAR",
    "idProofNumber": "1234-5678-9012",
    "photoUrl": "https://...",
    "loans": [
      {
        "id": "uuid",
        "loanNumber": "GL-1001",
        "principalPaise": 10000000,
        "status": "ACTIVE",
        "totalOutstandingPaise": 10200000,
        "dueDate": "2026-11-01T00:00:00Z"
      }
    ],
    "goldItems": [
      {
        "id": "uuid",
        "description": "Gold chain 22K",
        "weightGrams": "15.500",
        "purity": "K22",
        "status": "PLEDGED"
      }
    ]
  }
}
```

**Errors:**
- 403: Not authorized to view this customer
- 404: Customer not found

---

### PATCH /api/v1/customers/:id

Update customer details.

- Auth required: Yes
- Permission: CREATE_CUSTOMER

**Request (partial):**
```json
{
  "address": "New Address, Chennai",
  "mobileNumber": "9999999999"
}
```

**Response 200:** Updated customer object

**Errors:**
- 404: Customer not found
- 409: Mobile number conflict

---

### POST /api/v1/customers/:id/photo

Upload customer photo.

- Auth required: Yes
- Permission: CREATE_CUSTOMER
- Content-Type: multipart/form-data
- Max size: 5MB. Accepted types: image/jpeg, image/png

**Response 200:**
```json
{
  "success": true,
  "data": { "photoUrl": "https://storage.supabase.co/..." }
}
```

---

### POST /api/v1/customers/:id/document

Upload customer ID document.

- Auth required: Yes
- Permission: CREATE_CUSTOMER
- Content-Type: multipart/form-data
- Max size: 5MB. Accepted types: image/jpeg, image/png, application/pdf

**Response 200:**
```json
{
  "success": true,
  "data": { "idDocumentUrl": "https://storage.supabase.co/..." }
}
```

---

## 7. Gold Item Endpoints

### POST /api/v1/gold-items

Create a gold item for a customer.

- Auth required: Yes
- Permission: CREATE_CUSTOMER or CREATE_LOAN

**Request:**
```json
{
  "customerId": "uuid",
  "description": "Gold chain 22K, 3 links",
  "weightGrams": 15.5,
  "purity": "K22",
  "estimatedValuePaise": 9000000,
  "conditionNotes": "Good condition, minor scratch on clasp"
}
```

**Response 201:** GoldItem object

**Errors:**
- 400: Validation error
- 404: Customer not found

---

### GET /api/v1/gold-items/:id

Get gold item details.

- Auth required: Yes

**Response 200:** GoldItem object with customer and loan references

---

### PATCH /api/v1/gold-items/:id

Update gold item description or notes.

- Auth required: Yes
- Permission: OWNER role only

**Request (partial):**
```json
{
  "description": "Updated description",
  "conditionNotes": "Slight discoloration noted"
}
```

**Response 200:** Updated GoldItem object

---

### POST /api/v1/gold-items/:id/photo

Upload gold item photo.

- Auth required: Yes
- Content-Type: multipart/form-data
- Max size: 5MB

**Response 200:**
```json
{
  "success": true,
  "data": { "photoUrl": "https://storage.supabase.co/..." }
}
```

---

## 8. Loan Endpoints

### GET /api/v1/loans

List loans with filters.

- Auth required: Yes
- Permission: VIEW_ALL_LOANS

**Query params:**
- status: ACTIVE | OVERDUE | SETTLED | CLOSED
- customerId: uuid
- page: number (default: 1)
- pageSize: number (default: 20, max: 100)

**Response 200:** Paginated list of loans with computed outstanding amounts

---

### POST /api/v1/loans

Create a new loan.

- Auth required: Yes
- Permission: CREATE_LOAN

**Request:**
```json
{
  "customerId": "uuid",
  "goldItemIds": ["uuid1", "uuid2"],
  "principalPaise": 10000000,
  "monthlyRateBps": 200,
  "interestType": "FLAT_MONTHLY",
  "startDate": "2026-08-01",
  "tenureMonths": 3
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "loanNumber": "GL-1001",
    "customerId": "uuid",
    "principalPaise": 10000000,
    "monthlyRateBps": 200,
    "interestType": "FLAT_MONTHLY",
    "startDate": "2026-08-01T00:00:00Z",
    "dueDate": "2026-11-01T00:00:00Z",
    "tenureMonths": 3,
    "status": "ACTIVE",
    "outstandingPrincipalPaise": 10000000,
    "outstandingInterestPaise": 0,
    "totalOutstandingPaise": 10000000,
    "goldItems": [ ]
  }
}
```

**Errors:**
- 400: Validation error (invalid amounts, missing fields)
- 404: Customer or gold item not found
- 409: Gold item already pledged to another active loan
- 422: Customer is inactive

---

### GET /api/v1/loans/:id

Get full loan details with real-time outstanding amounts.

- Auth required: Yes
- Permission: VIEW_ALL_LOANS or created-by-self

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "loanNumber": "GL-1001",
    "customer": {
      "id": "uuid",
      "fullName": "Ravi Kumar",
      "mobileNumber": "9876543210"
    },
    "goldItems": [ ],
    "principalPaise": 10000000,
    "monthlyRateBps": 200,
    "interestType": "FLAT_MONTHLY",
    "startDate": "2026-08-01T00:00:00Z",
    "dueDate": "2026-11-01T00:00:00Z",
    "tenureMonths": 3,
    "status": "ACTIVE",
    "accruedInterestPaise": 200000,
    "totalInterestPaidPaise": 0,
    "totalPrincipalPaidPaise": 0,
    "outstandingInterestPaise": 200000,
    "outstandingPrincipalPaise": 10000000,
    "totalOutstandingPaise": 10200000,
    "asOfDate": "2026-08-13T10:00:00Z",
    "payments": [ ]
  }
}
```

---

### GET /api/v1/loans/overdue

Get all overdue loans.

- Auth required: Yes
- Permission: VIEW_OVERDUE_LOANS

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "loanNumber": "GL-1001",
      "customer": {
        "fullName": "Ravi Kumar",
        "mobileNumber": "9876543210"
      },
      "principalPaise": 10000000,
      "dueDate": "2026-07-01T00:00:00Z",
      "daysOverdue": 43,
      "totalOutstandingPaise": 10600000
    }
  ]
}
```

---

### GET /api/v1/loans/due-soon

Get loans due in the next 7 days.

- Auth required: Yes
- Permission: VIEW_OVERDUE_LOANS

**Response 200:** List of loans due within 7 days, sorted by dueDate ascending

---

## 9. Payment Endpoints

### POST /api/v1/payments

Record a payment against a loan.

- Auth required: Yes
- Permission: RECORD_PAYMENT

**Request:**
```json
{
  "loanId": "uuid",
  "paymentDate": "2026-08-13",
  "totalAmountPaise": 500000,
  "paymentMethod": "CASH",
  "paymentType": "PRINCIPAL_AND_INTEREST",
  "referenceNumber": null,
  "notes": null
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "loanId": "uuid",
    "paymentDate": "2026-08-13T00:00:00Z",
    "totalAmountPaise": 500000,
    "interestAmountPaise": 200000,
    "principalAmountPaise": 300000,
    "paymentMethod": "CASH",
    "paymentType": "PRINCIPAL_AND_INTEREST",
    "loanStatusAfter": "ACTIVE",
    "outstandingAfterPaise": 9900000
  }
}
```

**Errors:**
- 400: Amount less than 1 paise, missing fields
- 404: Loan not found
- 422: Loan is already SETTLED or CLOSED

---

### GET /api/v1/payments/:id

Get payment details.

- Auth required: Yes

**Response 200:** Full payment object

---

### GET /api/v1/loans/:loanId/payments

Get payment history for a specific loan.

- Auth required: Yes

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "paymentDate": "2026-08-13T00:00:00Z",
      "totalAmountPaise": 500000,
      "interestAmountPaise": 200000,
      "principalAmountPaise": 300000,
      "paymentMethod": "CASH",
      "recordedBy": { "fullName": "Staff Member" },
      "receipt": { "id": "uuid", "receiptNumber": "REC-10001" }
    }
  ]
}
```

---

## 10. Receipt Endpoints

### POST /api/v1/receipts/:paymentId

Generate a receipt for a payment.

- Auth required: Yes
- Permission: RECORD_PAYMENT

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "receiptNumber": "REC-10001",
    "paymentId": "uuid",
    "businessName": "ABC Gold Loans",
    "businessAddress": "123 Main Street, Chennai",
    "customerName": "Ravi Kumar",
    "customerMobile": "9876543210",
    "loanNumber": "GL-1001",
    "paymentDate": "2026-08-13T00:00:00Z",
    "amountPaidPaise": 500000,
    "paymentMethod": "CASH",
    "outstandingAfterPaise": 9900000,
    "recordedByName": "Staff Member",
    "footerText": "Thank you for your business.",
    "createdAt": "2026-08-13T10:05:00Z"
  }
}
```

**Errors:**
- 404: Payment not found
- 409: Receipt already exists for this payment

---

### GET /api/v1/receipts/:id

Get a receipt by ID (for display and printing).

- Auth required: Yes

**Response 200:** Full receipt object

---

## 11. Report Endpoints

All report endpoints:
- Auth required: Yes
- Permission: VIEW_REPORTS (or OWNER)

### GET /api/v1/reports/daily-collection

**Query params:**
- date: YYYY-MM-DD (default: today)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "date": "2026-08-13",
    "totalCollectedPaise": 1500000,
    "interestCollectedPaise": 600000,
    "principalCollectedPaise": 900000,
    "paymentCount": 5,
    "payments": [ ]
  }
}
```

---

### GET /api/v1/reports/monthly-collection

**Query params:**
- year: number (e.g., 2026)
- month: number 1-12 (e.g., 8)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "year": 2026,
    "month": 8,
    "totalCollectedPaise": 15000000,
    "interestCollectedPaise": 5000000,
    "principalCollectedPaise": 10000000,
    "paymentCount": 42,
    "dailyBreakdown": [
      { "date": "2026-08-01", "totalPaise": 500000, "count": 2 }
    ]
  }
}
```

---

### GET /api/v1/reports/outstanding

**Response 200:**
```json
{
  "success": true,
  "data": {
    "asOfDate": "2026-08-13T10:00:00Z",
    "activeLoanCount": 45,
    "totalPrincipalOutstandingPaise": 45000000,
    "totalInterestOutstandingPaise": 9000000,
    "totalOutstandingPaise": 54000000,
    "loans": [ ]
  }
}
```

---

### GET /api/v1/reports/overdue

**Response 200:** List of overdue loans with days overdue and outstanding amounts

---

### GET /api/v1/reports/interest-income

**Query params:**
- fromDate: YYYY-MM-DD
- toDate: YYYY-MM-DD

**Response 200:**
```json
{
  "success": true,
  "data": {
    "fromDate": "2026-08-01",
    "toDate": "2026-08-13",
    "totalInterestCollectedPaise": 3000000,
    "paymentCount": 18
  }
}
```

---

### GET /api/v1/reports/loan-summary

**Response 200:**
```json
{
  "success": true,
  "data": {
    "totalLoansEver": 120,
    "activeLoans": 45,
    "overdueLoans": 8,
    "settledLoans": 67,
    "totalPrincipalDisbursedPaise": 120000000,
    "totalCurrentOutstandingPaise": 54000000
  }
}
```

---

### GET /api/v1/reports/customer-ledger/:customerId

**Response 200:**
```json
{
  "success": true,
  "data": {
    "customer": { "fullName": "Ravi Kumar", "mobileNumber": "9876543210" },
    "loans": [
      {
        "loanNumber": "GL-1001",
        "principalPaise": 10000000,
        "status": "ACTIVE",
        "payments": [ ]
      }
    ]
  }
}
```

---

## 12. Audit Log Endpoints

### GET /api/v1/audit-logs

- Auth required: Yes
- Permission: OWNER role only

**Query params:**
- eventType: AuditEventType
- performedById: uuid
- affectedId: uuid
- affectedModel: string
- fromDate: YYYY-MM-DD
- toDate: YYYY-MM-DD
- page: number (default: 1)
- pageSize: number (default: 20, max: 50)

**Response 200:** Paginated audit log list

---

## 13. AI Assistant Endpoint

### POST /api/v1/ai/query

- Auth required: Yes
- Permission: USE_AI_ASSISTANT
- Rate limit: 20 requests per minute per user

**Request:**
```json
{
  "query": "Show me all overdue loans"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "answer": "There are 3 overdue loans:\n\n1. GL-1001 — Ravi Kumar\n   Outstanding: Rs. 1,06,000\n   Due: 1 Jul 2026 (43 days overdue)\n\n2. GL-1024 — Arun Babu\n   Outstanding: Rs. 85,000\n   Due: 10 Jul 2026 (34 days overdue)\n\n3. GL-1031 — Meena Devi\n   Outstanding: Rs. 1,20,000\n   Due: 5 Jul 2026 (39 days overdue)",
    "toolsUsed": ["get_overdue_loans"],
    "dataRetrievedAt": "2026-08-13T10:00:00Z"
  }
}
```

Note: Streaming response (text/event-stream) should be supported for better UX. The non-streaming response above is the fallback.

**Errors:**
- 400: Empty or missing query
- 403: USE_AI_ASSISTANT permission not granted
- 503: AI service unavailable (LLM API error)

**Rules:**
- AI never modifies any data
- All financial values in the response come from real database records
- AI tool calls execute backend service methods, not raw queries
- If data not found, response says so — no invented answers

---

## 14. Settings Endpoints

### GET /api/v1/settings

Get current business settings.

- Auth required: Yes

**Response 200:**
```json
{
  "success": true,
  "data": {
    "businessName": "ABC Gold Loans",
    "businessAddress": "123 Main Street, Chennai, Tamil Nadu",
    "businessPhone": "9876543210",
    "defaultMonthlyRateBps": 200,
    "defaultInterestType": "FLAT_MONTHLY",
    "defaultTenureMonths": 3,
    "currencySymbol": "Rs.",
    "receiptFooterText": "Thank you for your business. Please keep this receipt."
  }
}
```

---

### PATCH /api/v1/settings

Update business settings.

- Auth required: Yes
- Permission: OWNER role only

**Request (partial):**
```json
{
  "businessName": "XYZ Gold Loans",
  "defaultMonthlyRateBps": 250,
  "receiptFooterText": "All sales are final."
}
```

**Response 200:** Updated settings object

---

## 15. AI Tool Definitions (Backend)

The following tools are registered in the AI service and called by the LLM when appropriate.
Each tool validates inputs, checks permissions, and calls the corresponding backend service.

| Tool | Description |
|---|---|
| search_customers | Search customers by name or mobile number |
| get_customer_loans | Get all loans for a specific customer |
| get_customer_balance | Get outstanding balance for a specific customer across all active loans |
| search_loans | Search loans by status, amount range, or customer |
| get_loan_details | Get full details of a specific loan |
| get_overdue_loans | Get all overdue loans with days overdue and outstanding amounts |
| get_due_loans | Get loans due within N days |
| get_collection_summary | Get total payments collected in a date range |
| get_outstanding_summary | Get total outstanding across all active loans |
| get_payment_history | Get payment history for a loan or customer |
| get_interest_income | Get total interest collected in a date range |

Every tool:
1. Validates its parameters
2. Checks that the requesting user has the necessary permissions
3. Calls the appropriate backend service method
4. Returns only the data necessary to answer the question
5. Never exposes password hashes, internal IDs unnecessarily, or sensitive system fields
