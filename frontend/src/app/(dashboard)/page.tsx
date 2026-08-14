'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import type { Loan } from '@/types';

function StatCard({ title, value, sub, highlight }: { title: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-red-200' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-medium ${highlight ? 'text-red-600' : 'text-slate-600'}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${highlight ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2"><Skeleton className="h-4 w-32" /></CardHeader>
      <CardContent><Skeleton className="h-8 w-24" /></CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const today = new Date().toISOString().split('T')[0];

  const loanSummary = useQuery({
    queryKey: ['reports', 'loan-summary'],
    queryFn: async () => {
      const { data } = await api.get('/reports/loan-summary');
      return data.data as { activeLoans: number; overdueLoans: number; totalLoans: number };
    },
  });

  const outstanding = useQuery({
    queryKey: ['reports', 'outstanding'],
    queryFn: async () => {
      const { data } = await api.get('/reports/outstanding');
      return data.data as { totalOutstandingPaise: string };
    },
  });

  const dailyCollection = useQuery({
    queryKey: ['reports', 'daily-collection', today],
    queryFn: async () => {
      const { data } = await api.get('/reports/daily-collection', { params: { date: today } });
      return data.data as { totalCollectedPaise: string };
    },
  });

  const overdueLoans = useQuery({
    queryKey: ['reports', 'overdue'],
    queryFn: async () => {
      const { data } = await api.get('/reports/overdue');
      return (data.data as Loan[]).slice(0, 5);
    },
  });

  const dueSoon = useQuery({
    queryKey: ['loans', 'due-soon'],
    queryFn: async () => {
      const { data } = await api.get('/loans/due-soon');
      return data.data as Loan[];
    },
  });

  const isLoading = loanSummary.isLoading || outstanding.isLoading || dailyCollection.isLoading;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Active Loans"
              value={String(loanSummary.data?.activeLoans ?? '-')}
              sub={`${loanSummary.data?.totalLoans ?? 0} total loans`}
            />
            <StatCard
              title="Overdue Loans"
              value={String(loanSummary.data?.overdueLoans ?? '-')}
              highlight
            />
            <StatCard
              title="Total Outstanding"
              value={outstanding.data ? formatCurrency(outstanding.data.totalOutstandingPaise) : '-'}
            />
            <StatCard
              title="Today's Collections"
              value={dailyCollection.data ? formatCurrency(dailyCollection.data.totalCollectedPaise) : '-'}
              sub={formatDate(today)}
            />
          </>
        )}
      </div>

      {loanSummary.isError && <ErrorMessage message="Failed to load summary data." />}

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-red-600">Overdue Loans</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {overdueLoans.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : overdueLoans.isError ? (
              <div className="p-4"><ErrorMessage message="Failed to load overdue loans." /></div>
            ) : !overdueLoans.data?.length ? (
              <p className="text-sm text-slate-500 text-center py-8">No overdue loans</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueLoans.data.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <Link href={`/loans/${loan.id}`} className="text-yellow-700 hover:underline font-medium">
                          {loan.loanNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate-700">{loan.customer?.fullName}</TableCell>
                      <TableCell className="text-red-600">{loan.daysOverdue ?? '-'}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {loan.totalOutstandingPaise ? formatCurrency(loan.totalOutstandingPaise) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Due Soon */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Due Soon</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {dueSoon.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : dueSoon.isError ? (
              <div className="p-4"><ErrorMessage message="Failed to load due-soon loans." /></div>
            ) : !dueSoon.data?.length ? (
              <p className="text-sm text-slate-500 text-center py-8">No loans due soon</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dueSoon.data.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <Link href={`/loans/${loan.id}`} className="text-yellow-700 hover:underline font-medium">
                          {loan.loanNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate-700">{loan.customer?.fullName}</TableCell>
                      <TableCell className="text-sm text-slate-600">{formatDate(loan.dueDate)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {loan.totalOutstandingPaise ? formatCurrency(loan.totalOutstandingPaise) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
