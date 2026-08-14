'use client';
import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLoan } from '@/hooks/useLoans';
import { formatDate, formatCurrency, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { EmptyState } from '@/components/shared/EmptyState';

export default function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: loan, isLoading, isError } = useLoan(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !loan) {
    return <ErrorMessage message="Failed to load loan details." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={loan.loanNumber}
        subtitle={`Customer: ${loan.customer?.fullName ?? '-'}`}
        action={
          <div className="flex gap-2">
            {loan.status === 'ACTIVE' || loan.status === 'OVERDUE' ? (
              <Button onClick={() => router.push(`/payments/new?loanId=${loan.id}`)}>
                Record Payment
              </Button>
            ) : null}
            <Link href={`/customers/${loan.customerId}`}>
              <Button variant="outline">View Customer</Button>
            </Link>
          </div>
        }
      />

      {/* Loan Summary Card */}
      <Card>
        <CardHeader><CardTitle className="text-base">Loan Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: 'Status', value: <StatusBadge status={loan.status} /> },
              { label: 'Principal', value: <CurrencyDisplay paise={loan.principalPaise} /> },
              { label: 'Monthly Rate', value: `${(loan.monthlyRateBps / 100).toFixed(2)}%` },
              { label: 'Tenure', value: `${loan.tenureMonths} months` },
              { label: 'Start Date', value: formatDate(loan.startDate) },
              { label: 'Due Date', value: formatDate(loan.dueDate) },
              loan.daysOverdue
                ? { label: 'Days Overdue', value: <span className="text-red-600 font-semibold">{loan.daysOverdue}</span> }
                : null,
              loan.settledAt
                ? { label: 'Settled On', value: formatDate(loan.settledAt) }
                : null,
            ]
              .filter(Boolean)
              .map((item) => (
                <div key={item!.label}>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{item!.label}</dt>
                  <dd className="mt-1 text-sm text-slate-900">{item!.value}</dd>
                </div>
              ))}
          </div>

          {/* Outstanding amounts */}
          {(loan.outstandingPrincipalPaise || loan.outstandingInterestPaise || loan.totalOutstandingPaise) && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Outstanding Balances</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Principal</div>
                  <div className="text-lg font-bold text-slate-900">
                    <CurrencyDisplay paise={loan.outstandingPrincipalPaise ?? '0'} />
                  </div>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Interest</div>
                  <div className="text-lg font-bold text-slate-900">
                    <CurrencyDisplay paise={loan.outstandingInterestPaise ?? '0'} />
                  </div>
                </div>
                <div className="rounded-md bg-yellow-50 p-3 border border-yellow-200">
                  <div className="text-xs text-yellow-700">Total Outstanding</div>
                  <div className="text-lg font-bold text-yellow-800">
                    <CurrencyDisplay paise={loan.totalOutstandingPaise ?? '0'} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gold Items */}
      {loan.goldItems && loan.goldItems.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pledged Gold Items</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Weight (g)</TableHead>
                  <TableHead>Purity</TableHead>
                  <TableHead>Est. Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loan.goldItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.weightGrams}g</TableCell>
                    <TableCell>{item.purity}</TableCell>
                    <TableCell className="font-mono text-sm">{formatCurrency(item.estimatedValuePaise)}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Payment History</CardTitle>
          {(loan.status === 'ACTIVE' || loan.status === 'OVERDUE') && (
            <Button size="sm" onClick={() => router.push(`/payments/new?loanId=${loan.id}`)}>
              Record Payment
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {!loan.payments || loan.payments.length === 0 ? (
            <EmptyState title="No payments recorded" description="No payments have been made for this loan yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loan.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm text-slate-600">{formatDateTime(payment.paymentDate)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{formatCurrency(payment.totalAmountPaise)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(payment.interestAmountPaise)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(payment.principalAmountPaise)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{payment.paymentMethod}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{payment.paymentType.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      {payment.receipt ? (
                        <Link href={`/receipts/${payment.receipt.id}`} className="text-yellow-700 hover:underline text-sm">
                          {payment.receipt.receiptNumber}
                        </Link>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
