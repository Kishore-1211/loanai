'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { EmptyState } from '@/components/shared/EmptyState';
import type { AuditLog, PaginatedResponse } from '@/types';

const PAGE_SIZE = 30;

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<AuditLog>>('/audit-logs', {
        params: { page, pageSize: PAGE_SIZE },
      });
      return data;
    },
  });

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Track all important system events" />

      {isError && <ErrorMessage message="Failed to load audit logs." />}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !data?.data.length ? (
        <EmptyState title="No audit logs" description="No events have been logged yet." />
      ) : (
        <>
          <div className="rounded-md border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">{log.eventType}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-700">{log.performedByName}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{log.affectedModel}</TableCell>
                    <TableCell className="text-slate-500 text-xs font-mono">{log.affectedId.slice(0, 8)}...</TableCell>
                    <TableCell className="text-slate-500 text-sm">{formatDateTime(log.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data.meta && (
            <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
              <span>
                Page {page} of {data.meta.totalPages} ({data.meta.total} events)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
