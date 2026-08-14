'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';
import type { Loan } from '@/types';

export default function ReportsPage() {
  const today = new Date().toISOString().split('T')[0];
  const [collectionDate, setCollectionDate] = useState(today);
  const [queryDate, setQueryDate] = useState(today);

  const loanSummary = useQuery({
    queryKey: ['reports', 'loan-summary'],
    queryFn: async () => {
      const { data } = await api.get('/reports/loan-summary');
      return data.data as { activeLoans: number; overdueLoans: number; totalLoans: number; settledLoans: number };
    },
  });

  const outstanding = useQuery({
    queryKey: ['reports', 'outstanding'],
    queryFn: async () => {
      const { data } = await api.get('/reports/outstanding');
      return data.data as { totalOutstandingPaise: string; totalPrincipalPaise: string; totalInterestPaise: string };
    },
  });

  const dailyCollection = useQuery({
    queryKey: ['reports', 'daily-collection', queryDate],
    queryFn: async () => {
      const { data } = await api.get('/reports/daily-collection', { params: { date: queryDate } });
      return data.data as { totalCollectedPaise: string; paymentsCount: number };
    },
  });

  const overdueLoans = useQuery({
    queryKey: ['reports', 'overdue'],
    queryFn: async () => {
      const { data } = await api.get('/reports/overdue');
      return data.data as Loan[];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Business performance and analytics" />

      {/* Loan summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loanSummary.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : loanSummary.isError ? (
          <div className="col-span-4"><ErrorMessage message="Failed to load loan summary." /></div>
        ) : (
          <>
            {[
              { label: 'Total Loans', value: loanSummary.data?.totalLoans ?? 0 },
              { label: 'Active Loans', value: loanSummary.data?.activeLoans ?? 0 },
              { label: 'Overdue Loans', value: loanSummary.data?.overdueLoans ?? 0, highlight: true },
              { label: 'Settled Loans', value: loanSummary.data?.settledLoans ?? 0 },
            ].map(({ label, value, highlight }) => (
              <Card key={label} className={highlight ? 'border-red-200' : ''}>
                <CardHeader className="pb-1">
                  <CardTitle className={`text-xs font-medium ${highlight ? 'text-red-600' : 'text-slate-500'}`}>{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className={`text-2xl font-bold ${highlight ? 'text-red-700' : 'text-slate-900'}`}>{value}</span>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Outstanding */}
      <Card>
        <CardHeader><CardTitle className="text-base">Outstanding Portfolio</CardTitle></CardHeader>
        <CardContent>
          {outstanding.isLoading ? (
            <div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : outstanding.isError ? (
            <ErrorMessage message="Failed to load outstanding data." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-md bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Total Principal</div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  <CurrencyDisplay paise={outstanding.data?.totalPrincipalPaise ?? '0'} />
                </div>
              </div>
              <div className="rounded-md bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Total Interest</div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  <CurrencyDisplay paise={outstanding.data?.totalInterestPaise ?? '0'} />
                </div>
              </div>
              <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
                <div className="text-xs text-yellow-700">Total Outstanding</div>
                <div className="text-xl font-bold text-yellow-800 mt-1">
                  <CurrencyDisplay paise={outstanding.data?.totalOutstandingPaise ?? '0'} />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Collection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Daily Collection</CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">Date</Label>
              <Input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="w-40 text-sm"
              />
              <Button size="sm" onClick={() => setQueryDate(collectionDate)}>Query</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dailyCollection.isLoading ? (
            <Skeleton className="h-16 w-48" />
          ) : dailyCollection.isError ? (
            <ErrorMessage message="Failed to load daily collection." />
          ) : (
            <div className="flex gap-6">
              <div>
                <div className="text-xs text-slate-500">Total Collected</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  <CurrencyDisplay paise={dailyCollection.data?.totalCollectedPaise ?? '0'} />
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Payments</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{dailyCollection.data?.paymentsCount ?? 0}</div>
              </div>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-2">For {formatDate(queryDate)}</p>
        </CardContent>
      </Card>

      {/* Overdue list */}
      <Card>
        <CardHeader><CardTitle className="text-base text-red-600">All Overdue Loans</CardTitle></CardHeader>
        <CardContent className="p-0">
          {overdueLoans.isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
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
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueLoans.data.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium text-yellow-700">{loan.loanNumber}</TableCell>
                    <TableCell>{loan.customer?.fullName}</TableCell>
                    <TableCell className="text-sm text-slate-600">{formatDate(loan.dueDate)}</TableCell>
                    <TableCell className="text-red-600 font-medium">{loan.daysOverdue ?? '-'}</TableCell>
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
  );
}
