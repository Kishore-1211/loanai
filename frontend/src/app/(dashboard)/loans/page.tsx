'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLoans } from '@/hooks/useLoans';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import type { LoanStatus } from '@/types';

const TABS: { label: string; value: LoanStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Settled', value: 'SETTLED' },
];

const PAGE_SIZE = 20;

export default function LoansPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get('status') as LoanStatus | null) ?? '';
  const [status, setStatus] = useState<LoanStatus | ''>(initialStatus);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useLoans({ status, page, pageSize: PAGE_SIZE });

  return (
    <div>
      <PageHeader
        title="Loans"
        subtitle="Manage all gold loans"
        action={
          <Button onClick={() => router.push('/loans/new')}>New Loan</Button>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatus(tab.value); setPage(1); }}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              status === tab.value
                ? 'border-yellow-600 text-yellow-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isError && <ErrorMessage message="Failed to load loans." />}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !data?.data.length ? (
        <EmptyState
          title="No loans found"
          description={status ? `No ${status.toLowerCase()} loans.` : 'Create your first loan to get started.'}
          actionLabel={status ? undefined : 'New Loan'}
          onAction={status ? undefined : () => router.push('/loans/new')}
        />
      ) : (
        <>
          <div className="rounded-md border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead>Rate/Month</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((loan) => (
                  <TableRow
                    key={loan.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/loans/${loan.id}`)}
                  >
                    <TableCell>
                      <Link
                        href={`/loans/${loan.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-yellow-700 hover:underline font-medium"
                      >
                        {loan.loanNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-700">{loan.customer?.fullName ?? '-'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(loan.principalPaise)}</TableCell>
                    <TableCell className="text-slate-600">{(loan.monthlyRateBps / 100).toFixed(2)}%</TableCell>
                    <TableCell className="text-sm text-slate-600">{formatDate(loan.dueDate)}</TableCell>
                    <TableCell><StatusBadge status={loan.status} /></TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {loan.totalOutstandingPaise ? formatCurrency(loan.totalOutstandingPaise) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data.meta && (
            <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.meta.total)} of {data.meta.total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
