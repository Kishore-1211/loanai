export type Role = 'OWNER' | 'STAFF';
export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'SETTLED' | 'CLOSED';
export type GoldItemStatus = 'PLEDGED' | 'RELEASED' | 'AUCTIONED';
export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
export type PaymentType = 'INTEREST_ONLY' | 'PRINCIPAL_AND_INTEREST' | 'FULL_SETTLEMENT';
export type InterestType = 'FLAT_MONTHLY';
export type GoldPurity = 'K18' | 'K20' | 'K22' | 'K24';
export type IdProofType = 'AADHAAR' | 'PAN' | 'VOTER_ID' | 'PASSPORT' | 'DRIVING_LICENSE';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  fullName: string;
  mobileNumber: string;
  address: string;
  idProofType: IdProofType;
  idProofNumber: string;
  dateOfBirth?: string;
  isActive: boolean;
  createdAt: string;
  createdById?: string;
}

export interface GoldItem {
  id: string;
  customerId: string;
  loanId?: string;
  description: string;
  weightGrams: string;
  purity: GoldPurity;
  estimatedValuePaise: string;
  conditionNotes?: string;
  status: GoldItemStatus;
  createdAt: string;
}

export interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  customer?: Pick<Customer, 'id' | 'fullName' | 'mobileNumber'>;
  goldItems?: GoldItem[];
  principalPaise: string;
  monthlyRateBps: number;
  interestType: InterestType;
  startDate: string;
  dueDate: string;
  tenureMonths: number;
  status: LoanStatus;
  settledAt?: string;
  createdById: string;
  createdAt: string;
  accruedInterestPaise?: string;
  outstandingInterestPaise?: string;
  outstandingPrincipalPaise?: string;
  totalOutstandingPaise?: string;
  effectiveStatus?: string;
  daysOverdue?: number;
  payments?: Payment[];
}

export interface Payment {
  id: string;
  loanId: string;
  paymentDate: string;
  totalAmountPaise: string;
  interestAmountPaise: string;
  principalAmountPaise: string;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  referenceNumber?: string;
  notes?: string;
  recordedBy?: { id: string; fullName: string };
  receipt?: { id: string; receiptNumber: string };
  loanStatusAfter?: LoanStatus;
  outstandingAfterPaise?: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  paymentId: string;
  businessName: string;
  businessAddress: string;
  customerName: string;
  customerMobile: string;
  loanNumber: string;
  paymentDate: string;
  amountPaidPaise: string;
  paymentMethod: PaymentMethod;
  outstandingAfterPaise: string;
  recordedByName: string;
  footerText?: string;
  createdAt: string;
}

export interface BusinessSettings {
  businessName: string;
  businessAddress: string;
  businessPhone?: string;
  defaultMonthlyRateBps: number;
  defaultInterestType: InterestType;
  defaultTenureMonths: number;
  currencySymbol: string;
  receiptFooterText?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export interface AuditLog {
  id: string;
  eventType: string;
  performedById: string;
  performedByName: string;
  affectedModel: string;
  affectedId: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  createdAt: string;
}
