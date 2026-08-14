'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useLoan } from '@/hooks/useLoans';
import { useCreatePayment } from '@/hooks/usePayments';
import { rupeesToPaise, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay';

const schema = z.object({
  paymentDate: z.string().min(1, 'Select a payment date'),
  amountRupees: z.string().min(1, 'Enter amount').refine(v => Number(v) > 0, 'Must be greater than 0'),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'], { required_error: 'Select payment method' }),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function RecordPaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const loanId = searchParams.get('loanId') ?? '';

  const { data: loan, isLoading, isError } = useLoan(loanId);
  const createPayment = useCreatePayment();

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { paymentDate: new Date().toISOString().split('T')[0] },
  });

  if (!loanId) return <ErrorMessage message="No loan specified." />;
  if (isLoading) return <LoadingSpinner className="mt-12" />;
  if (isError || !loan) return <ErrorMessage message="Failed to load loan." />;

  const onSubmit = async (data: FormData) => {
    try {
      const payment = await createPayment.mutateAsync({
        loanId,
        paymentDate: data.paymentDate,
        totalAmountPaise: rupeesToPaise(data.amountRupees),
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber || undefined,
        notes: data.notes || undefined,
      });
      toast.success('Payment recorded successfully');
      if (payment.receipt?.id) {
        router.push(`/receipts/${payment.receipt.id}`);
      } else {
        router.push(`/loans/${loanId}`);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || 'Failed to record payment');
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Record Payment" subtitle={`Loan: ${loan.loanNumber} — ${loan.customer?.fullName}`} />

      {/* Loan summary */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Loan Outstanding</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-md bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Interest Due</div>
              <div className="text-base font-semibold text-slate-900">
                <CurrencyDisplay paise={loan.outstandingInterestPaise ?? '0'} />
              </div>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Principal Due</div>
              <div className="text-base font-semibold text-slate-900">
                <CurrencyDisplay paise={loan.outstandingPrincipalPaise ?? '0'} />
              </div>
            </div>
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
              <div className="text-xs text-yellow-700">Total Due</div>
              <div className="text-base font-semibold text-yellow-800">
                <CurrencyDisplay paise={loan.totalOutstandingPaise ?? '0'} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Payment Date *</Label>
                <Input id="paymentDate" type="date" {...register('paymentDate')} />
                {errors.paymentDate && <p className="text-sm text-red-600">{errors.paymentDate.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="amountRupees">Amount (Rs.) *</Label>
                <Input
                  id="amountRupees"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder={loan.totalOutstandingPaise ? String(Number(loan.totalOutstandingPaise) / 100) : ''}
                  {...register('amountRupees')}
                />
                {errors.amountRupees && <p className="text-sm text-red-600">{errors.amountRupees.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select onValueChange={(v) => setValue('paymentMethod', v as FormData['paymentMethod'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
              {errors.paymentMethod && <p className="text-sm text-red-600">{errors.paymentMethod.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference Number (optional)</Label>
              <Input id="referenceNumber" placeholder="UPI/Cheque reference" {...register('referenceNumber')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" placeholder="Any notes..." rows={2} {...register('notes')} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting || createPayment.isPending}>
                {isSubmitting || createPayment.isPending ? 'Recording...' : 'Record Payment'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
