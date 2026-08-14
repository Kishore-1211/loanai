'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useCustomer } from '@/hooks/useCustomers';
import { useCreateGoldItem } from '@/hooks/useGoldItems';
import { formatDate, formatCurrency, rupeesToPaise } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Loan, GoldItem } from '@/types';

const goldItemSchema = z.object({
  description: z.string().min(2, 'Min 2 characters').max(500),
  weightGrams: z.string().refine(v => Number(v) > 0, 'Must be greater than 0'),
  purity: z.enum(['K18', 'K20', 'K22', 'K24']),
  estimatedValueRupees: z.string().refine(v => Number(v) > 0, 'Must be greater than 0'),
  conditionNotes: z.string().max(1000).optional(),
});
type GoldItemForm = z.infer<typeof goldItemSchema>;

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: customer, isLoading, isError } = useCustomer(id);
  const [showAddGoldItem, setShowAddGoldItem] = useState(false);
  const createGoldItem = useCreateGoldItem();

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<GoldItemForm>({
    resolver: zodResolver(goldItemSchema),
  });

  const onAddGoldItem = async (data: GoldItemForm) => {
    try {
      await createGoldItem.mutateAsync({
        customerId: id,
        description: data.description,
        weightGrams: Number(data.weightGrams),
        purity: data.purity,
        estimatedValuePaise: rupeesToPaise(data.estimatedValueRupees),
        conditionNotes: data.conditionNotes || undefined,
      });
      toast.success('Gold item added successfully');
      setShowAddGoldItem(false);
      reset();
    } catch {
      toast.error('Failed to add gold item');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !customer) {
    return <ErrorMessage message="Failed to load customer details." />;
  }

  const loans = (customer as unknown as { loans: Loan[] }).loans ?? [];
  const goldItems = (customer as unknown as { goldItems: GoldItem[] }).goldItems ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.fullName}
        subtitle={`Customer since ${formatDate(customer.createdAt)}`}
        action={
          <Button onClick={() => router.push(`/loans/new?customerId=${customer.id}`)}>
            Create Loan
          </Button>
        }
      />

      {/* Info Card */}
      <Card>
        <CardHeader><CardTitle className="text-base">Customer Information</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Mobile', value: customer.mobileNumber },
              { label: 'ID Type', value: customer.idProofType },
              { label: 'ID Number', value: customer.idProofNumber },
              { label: 'Date of Birth', value: customer.dateOfBirth ? formatDate(customer.dateOfBirth) : '-' },
              { label: 'Status', value: customer.isActive ? 'Active' : 'Inactive' },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</dt>
                <dd className="mt-1 text-sm text-slate-900">{value}</dd>
              </div>
            ))}
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Address</dt>
              <dd className="mt-1 text-sm text-slate-900">{customer.address}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Loans */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Loans ({loans.length})</CardTitle>
          <Button size="sm" onClick={() => router.push(`/loans/new?customerId=${customer.id}`)}>
            New Loan
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loans.length === 0 ? (
            <EmptyState title="No loans" description="This customer has no loans yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan No.</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <Link href={`/loans/${loan.id}`} className="text-yellow-700 hover:underline font-medium">
                        {loan.loanNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatCurrency(loan.principalPaise)}</TableCell>
                    <TableCell className="text-sm text-slate-600">{formatDate(loan.dueDate)}</TableCell>
                    <TableCell><StatusBadge status={loan.status} /></TableCell>
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

      {/* Gold Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Gold Items ({goldItems.length})</CardTitle>
          <Button size="sm" onClick={() => setShowAddGoldItem(true)}>Add Gold Item</Button>
        </CardHeader>
        <CardContent className="p-0">
          {goldItems.length === 0 ? (
            <EmptyState title="No gold items" description="No gold items pledged by this customer." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Weight (g)</TableHead>
                  <TableHead>Purity</TableHead>
                  <TableHead>Est. Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goldItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-slate-900">{item.description}</TableCell>
                    <TableCell className="text-slate-600">{item.weightGrams}g</TableCell>
                    <TableCell className="text-slate-600">{item.purity}</TableCell>
                    <TableCell className="font-mono text-sm">{formatCurrency(item.estimatedValuePaise)}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* Add Gold Item Dialog */}
      <Dialog open={showAddGoldItem} onOpenChange={setShowAddGoldItem}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Gold Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onAddGoldItem)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input id="description" placeholder="e.g. Gold necklace, Gold ring" {...register('description')} />
              {errors.description && <p className="text-sm text-red-600">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="weightGrams">Weight (grams) *</Label>
                <Input id="weightGrams" type="number" step="0.001" min="0.001" placeholder="10.5" {...register('weightGrams')} />
                {errors.weightGrams && <p className="text-sm text-red-600">{errors.weightGrams.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Purity *</Label>
                <Select onValueChange={(v) => setValue('purity', v as GoldItemForm['purity'])}>
                  <SelectTrigger><SelectValue placeholder="Select purity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="K18">18K</SelectItem>
                    <SelectItem value="K20">20K</SelectItem>
                    <SelectItem value="K22">22K</SelectItem>
                    <SelectItem value="K24">24K</SelectItem>
                  </SelectContent>
                </Select>
                {errors.purity && <p className="text-sm text-red-600">{errors.purity.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedValueRupees">Estimated Value (Rs.) *</Label>
              <Input id="estimatedValueRupees" type="number" min="1" step="1" placeholder="25000" {...register('estimatedValueRupees')} />
              {errors.estimatedValueRupees && <p className="text-sm text-red-600">{errors.estimatedValueRupees.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="conditionNotes">Condition Notes <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input id="conditionNotes" placeholder="e.g. Minor scratches, good condition" {...register('conditionNotes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowAddGoldItem(false); reset(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || createGoldItem.isPending}>
                {isSubmitting || createGoldItem.isPending ? 'Adding...' : 'Add Gold Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
