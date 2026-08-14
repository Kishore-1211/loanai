'use client';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import type { BusinessSettings, ApiResponse } from '@/types';

const schema = z.object({
  businessName: z.string().min(2, 'Required'),
  businessAddress: z.string().min(5, 'Required'),
  businessPhone: z.string().optional(),
  defaultMonthlyRateBps: z.number().min(1, 'Required'),
  defaultTenureMonths: z.number().min(1, 'Required'),
  receiptFooterText: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<BusinessSettings>>('/settings');
      return data.data;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (payload: Partial<BusinessSettings>) => {
      const { data } = await api.patch<ApiResponse<BusinessSettings>>('/settings', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved successfully');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (settings) {
      reset({
        businessName: settings.businessName,
        businessAddress: settings.businessAddress,
        businessPhone: settings.businessPhone ?? '',
        defaultMonthlyRateBps: settings.defaultMonthlyRateBps,
        defaultTenureMonths: settings.defaultTenureMonths,
        receiptFooterText: settings.receiptFooterText ?? '',
      });
    }
  }, [settings, reset]);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (isError) return <ErrorMessage message="Failed to load settings." />;

  const onSubmit = async (data: FormData) => {
    await updateSettings.mutateAsync({
      ...data,
      defaultInterestType: 'FLAT_MONTHLY',
      currencySymbol: 'Rs.',
    });
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" subtitle="Configure your business settings" />
      <Card>
        <CardHeader><CardTitle className="text-base">Business Information</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input id="businessName" {...register('businessName')} />
                {errors.businessName && <p className="text-sm text-red-600">{errors.businessName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessPhone">Phone</Label>
                <Input id="businessPhone" {...register('businessPhone')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessAddress">Address *</Label>
              <Textarea id="businessAddress" rows={2} {...register('businessAddress')} />
              {errors.businessAddress && <p className="text-sm text-red-600">{errors.businessAddress.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultMonthlyRateBps">Default Monthly Rate (basis points) *</Label>
                <Input id="defaultMonthlyRateBps" type="number" {...register('defaultMonthlyRateBps', { valueAsNumber: true })} />
                <p className="text-xs text-slate-400">e.g. 250 = 2.5%</p>
                {errors.defaultMonthlyRateBps && <p className="text-sm text-red-600">{errors.defaultMonthlyRateBps.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultTenureMonths">Default Tenure (months) *</Label>
                <Input id="defaultTenureMonths" type="number" {...register('defaultTenureMonths', { valueAsNumber: true })} />
                {errors.defaultTenureMonths && <p className="text-sm text-red-600">{errors.defaultTenureMonths.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receiptFooterText">Receipt Footer Text</Label>
              <Textarea id="receiptFooterText" rows={2} placeholder="Thank you for your business." {...register('receiptFooterText')} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting || updateSettings.isPending || !isDirty}>
                {isSubmitting || updateSettings.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button type="button" variant="outline" onClick={() => reset()}>Reset</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
