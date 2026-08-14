import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CurrencyDisplayProps {
  paise: string | number | bigint;
  className?: string;
}

export function CurrencyDisplay({ paise, className }: CurrencyDisplayProps) {
  return <span className={cn('font-mono', className)}>{formatCurrency(paise)}</span>;
}
