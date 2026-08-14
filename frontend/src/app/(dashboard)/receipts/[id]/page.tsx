'use client';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';
import { useReceipt } from '@/hooks/usePayments';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: receipt, isLoading, isError } = useReceipt(id);

  if (isLoading) return <div className="space-y-4 max-w-lg mx-auto mt-8"><Skeleton className="h-8 w-48 mx-auto" /><Skeleton className="h-64 w-full" /></div>;
  if (isError || !receipt) return <ErrorMessage message="Failed to load receipt." />;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>Back</Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Print Receipt
        </Button>
      </div>

      {/* Print-friendly receipt */}
      <div className="bg-white rounded-lg border border-slate-200 p-8 print:border-0 print:p-0 print:shadow-none">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-900">{receipt.businessName}</h1>
          <p className="text-sm text-slate-600 mt-1">{receipt.businessAddress}</p>
          <div className="mt-4 inline-block bg-yellow-50 border border-yellow-200 rounded px-4 py-1">
            <span className="text-yellow-800 font-semibold text-sm">PAYMENT RECEIPT</span>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Receipt meta */}
        <div className="flex justify-between text-sm mb-4">
          <div>
            <span className="text-slate-500">Receipt No:</span>{' '}
            <span className="font-medium text-slate-900">{receipt.receiptNumber}</span>
          </div>
          <div>
            <span className="text-slate-500">Date:</span>{' '}
            <span className="font-medium text-slate-900">{formatDate(receipt.paymentDate)}</span>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Customer + Loan */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Customer:</span>
            <span className="font-medium text-slate-900">{receipt.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Mobile:</span>
            <span className="text-slate-700">{receipt.customerMobile}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Loan No:</span>
            <span className="font-medium text-slate-900">{receipt.loanNumber}</span>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Payment details */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Payment Method:</span>
            <span className="text-slate-700">{receipt.paymentMethod.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Amount Paid:</span>
            <span className="text-xl font-bold text-slate-900">
              <CurrencyDisplay paise={receipt.amountPaidPaise} />
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Outstanding After:</span>
            <span className="font-medium text-slate-700">
              <CurrencyDisplay paise={receipt.outstandingAfterPaise} />
            </span>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 mt-4 space-y-1">
          <p>Recorded by: {receipt.recordedByName}</p>
          <p>Generated: {formatDateTime(receipt.createdAt)}</p>
          {receipt.footerText && <p className="mt-2 italic">{receipt.footerText}</p>}
        </div>
      </div>
    </div>
  );
}
