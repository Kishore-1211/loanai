'use client';
import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useCreateLoan } from '@/hooks/useLoans';
import { rupeesToPaise } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Customer, GoldItem } from '@/types';

const schema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  principalRupees: z.string().min(1, 'Enter principal amount').refine(v => Number(v) > 0, 'Must be greater than 0'),
  monthlyRatePct: z.string().min(1, 'Enter monthly rate').refine(v => Number(v) > 0, 'Must be greater than 0'),
  tenureMonths: z.string().min(1, 'Enter tenure'),
  startDate: z.string().min(1, 'Select start date'),
});
type FormData = z.infer<typeof schema>;

export default function NewLoanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCustomerId = searchParams.get('customerId') ?? '';

  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(prefilledCustomerId);
  const [selectedGoldItems, setSelectedGoldItems] = useState<string[]>([]);

  const createLoan = useCreateLoan();

  const handleSearchChange = useCallback((val: string) => {
    setCustomerSearch(val);
    clearTimeout((window as { _lsTimer?: ReturnType<typeof setTimeout> })._lsTimer);
    (window as { _lsTimer?: ReturnType<typeof setTimeout> })._lsTimer = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  const customerSearch_ = useQuery({
    queryKey: ['customers', 'search', debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get<{ data: Customer[] }>('/customers', { params: { search: debouncedSearch, pageSize: 10 } });
      return data.data;
    },
    enabled: debouncedSearch.length >= 2,
  });

  const selectedCustomer = useQuery({
    queryKey: ['customers', selectedCustomerId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Customer & { goldItems: GoldItem[] } }>(`/customers/${selectedCustomerId}`);
      return data.data;
    },
    enabled: !!selectedCustomerId,
  });

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { customerId: prefilledCustomerId, startDate: new Date().toISOString().split('T')[0] },
  });

  const onSubmit = async (data: FormData) => {
    if (selectedGoldItems.length === 0) {
      toast.error('Select at least one gold item to pledge as collateral');
      return;
    }
    try {
      const loan = await createLoan.mutateAsync({
        customerId: data.customerId,
        goldItemIds: selectedGoldItems,
        principalPaise: rupeesToPaise(data.principalRupees),
        monthlyRateBps: Math.round(Number(data.monthlyRatePct) * 100),
        tenureMonths: Number(data.tenureMonths),
        startDate: data.startDate,
        interestType: 'FLAT_MONTHLY',
      });
      toast.success('Loan created successfully');
      router.push(`/loans/${loan.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || 'Failed to create loan');
    }
  };

  const availableItems = selectedCustomer.data?.goldItems?.filter(i => !i.loanId) ?? [];

  return (
    <div className="max-w-2xl">
      <PageHeader title="New Loan" subtitle="Create a new gold loan" />
      <Card>
        <CardHeader><CardTitle className="text-base">Loan Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Customer selection */}
            <div className="space-y-2">
              <Label>Customer *</Label>
              {!selectedCustomerId ? (
                <>
                  <Input
                    placeholder="Search customer by name or mobile..."
                    value={customerSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                  {customerSearch_.isLoading && <LoadingSpinner size="sm" />}
                  {customerSearch_.data && customerSearch_.data.length > 0 && (
                    <div className="border rounded-md divide-y bg-white shadow-sm">
                      {customerSearch_.data.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setValue('customerId', c.id);
                            setCustomerSearch('');
                          }}
                        >
                          <span className="font-medium">{c.fullName}</span>
                          <span className="text-slate-500 ml-2">{c.mobileNumber}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {debouncedSearch.length >= 2 && customerSearch_.data?.length === 0 && (
                    <p className="text-sm text-slate-500">No customers found.</p>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-slate-50">
                  <div>
                    <span className="font-medium text-slate-900">{selectedCustomer.data?.fullName ?? 'Loading...'}</span>
                    <span className="text-slate-500 ml-2 text-sm">{selectedCustomer.data?.mobileNumber}</span>
                  </div>
                  <button type="button" className="text-sm text-red-500 hover:text-red-700" onClick={() => { setSelectedCustomerId(''); setValue('customerId', ''); }}>
                    Change
                  </button>
                </div>
              )}
              {errors.customerId && <p className="text-sm text-red-600">{errors.customerId.message}</p>}
              <input type="hidden" {...register('customerId')} />
            </div>

            {/* Gold Items */}
            {selectedCustomerId && (
              <div className="space-y-2">
                <Label>Gold Items * <span className="text-slate-500 font-normal">(select at least one)</span></Label>
                {availableItems.length === 0 ? (
                  selectedCustomer.isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <p className="text-sm text-amber-600 border border-amber-200 bg-amber-50 rounded-md px-3 py-2">
                      No available gold items for this customer. Add gold items to the customer&apos;s profile first.
                    </p>
                  )
                ) : (
                  <div className="border rounded-md divide-y">
                    {availableItems.map((item) => (
                      <label key={item.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selectedGoldItems.includes(item.id)}
                          onChange={(e) => {
                            setSelectedGoldItems(prev =>
                              e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id)
                            );
                          }}
                        />
                        <span className="text-sm text-slate-700">{item.description} — {item.weightGrams}g {item.purity}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="principalRupees">Principal Amount (Rs.) *</Label>
                <Input id="principalRupees" type="number" min="1" step="1" placeholder="50000" {...register('principalRupees')} />
                {errors.principalRupees && <p className="text-sm text-red-600">{errors.principalRupees.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlyRatePct">Monthly Interest Rate (%) *</Label>
                <Input id="monthlyRatePct" type="number" min="0.01" step="0.01" placeholder="2.5" {...register('monthlyRatePct')} />
                {errors.monthlyRatePct && <p className="text-sm text-red-600">{errors.monthlyRatePct.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenureMonths">Tenure (Months) *</Label>
                <Input id="tenureMonths" type="number" min="1" step="1" placeholder="12" {...register('tenureMonths')} />
                {errors.tenureMonths && <p className="text-sm text-red-600">{errors.tenureMonths.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" type="date" {...register('startDate')} />
                {errors.startDate && <p className="text-sm text-red-600">{errors.startDate.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Interest Type</Label>
              <Input value="Flat Monthly" disabled className="bg-slate-50 text-slate-500" />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting || createLoan.isPending}>
                {isSubmitting || createLoan.isPending ? 'Creating...' : 'Create Loan'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
