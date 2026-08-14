import { Badge } from '@/components/ui/badge';
import type { LoanStatus, GoldItemStatus } from '@/types';
import { cn } from '@/lib/utils';

type Status = LoanStatus | GoldItemStatus;

const statusConfig: Record<Status, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-green-100 text-green-800 border-green-200' },
  OVERDUE: { label: 'Overdue', className: 'bg-red-100 text-red-800 border-red-200' },
  SETTLED: { label: 'Settled', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  CLOSED: { label: 'Closed', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  PLEDGED: { label: 'Pledged', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  RELEASED: { label: 'Released', className: 'bg-green-100 text-green-800 border-green-200' },
  AUCTIONED: { label: 'Auctioned', className: 'bg-orange-100 text-orange-800 border-orange-200' },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' };
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
