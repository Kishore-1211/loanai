'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, UserPlus } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { EmptyState } from '@/components/shared/EmptyState';

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((window as { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer);
    (window as { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  }, []);

  const { data, isLoading, isError } = useCustomers({
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage your customer records"
        action={
          <Button onClick={() => router.push('/customers/new')}>
            <UserPlus className="h-4 w-4 mr-2" />
            New Customer
          </Button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by name or mobile..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {isError && <ErrorMessage message="Failed to load customers." />}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !data?.data.length ? (
        <EmptyState
          title="No customers found"
          description={debouncedSearch ? 'Try a different search term.' : 'Add your first customer to get started.'}
          actionLabel={debouncedSearch ? undefined : 'New Customer'}
          onAction={debouncedSearch ? undefined : () => router.push('/customers/new')}
        />
      ) : (
        <>
          <div className="rounded-md border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>ID Type</TableHead>
                  <TableHead>ID Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((customer) => (
                  <TableRow key={customer.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/customers/${customer.id}`)}>
                    <TableCell className="font-medium text-slate-900">{customer.fullName}</TableCell>
                    <TableCell className="text-slate-600">{customer.mobileNumber}</TableCell>
                    <TableCell className="text-slate-600">{customer.idProofType}</TableCell>
                    <TableCell className="text-slate-600">{customer.idProofNumber}</TableCell>
                    <TableCell>
                      <Badge variant={customer.isActive ? 'default' : 'secondary'}>
                        {customer.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">{formatDate(customer.createdAt)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/customers/${customer.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-yellow-700 hover:underline text-sm"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
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
