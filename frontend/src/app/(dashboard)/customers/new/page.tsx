'use client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useCreateCustomer } from '@/hooks/useCustomers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';

const schema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  mobileNumber: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  idProofType: z.enum(['AADHAAR', 'PAN', 'VOTER_ID', 'PASSPORT', 'DRIVING_LICENSE'], {
    required_error: 'Select an ID proof type',
  }),
  idProofNumber: z.string().min(4, 'Enter a valid ID proof number'),
  dateOfBirth: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function NewCustomerPage() {
  const router = useRouter();
  const createCustomer = useCreateCustomer();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const newCustomer = await createCustomer.mutateAsync(data);
      toast.success('Customer created successfully');
      router.push(`/customers/${newCustomer.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || 'Failed to create customer');
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="New Customer" subtitle="Add a new customer to the system" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input id="fullName" placeholder="John Doe" {...register('fullName')} />
                {errors.fullName && <p className="text-sm text-red-600">{errors.fullName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobileNumber">Mobile Number *</Label>
                <Input id="mobileNumber" placeholder="9876543210" {...register('mobileNumber')} />
                {errors.mobileNumber && <p className="text-sm text-red-600">{errors.mobileNumber.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Textarea id="address" placeholder="Full address..." rows={3} {...register('address')} />
              {errors.address && <p className="text-sm text-red-600">{errors.address.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID Proof Type *</Label>
                <Select onValueChange={(v) => setValue('idProofType', v as FormData['idProofType'])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AADHAAR">Aadhaar</SelectItem>
                    <SelectItem value="PAN">PAN Card</SelectItem>
                    <SelectItem value="VOTER_ID">Voter ID</SelectItem>
                    <SelectItem value="PASSPORT">Passport</SelectItem>
                    <SelectItem value="DRIVING_LICENSE">Driving License</SelectItem>
                  </SelectContent>
                </Select>
                {errors.idProofType && <p className="text-sm text-red-600">{errors.idProofType.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="idProofNumber">ID Proof Number *</Label>
                <Input id="idProofNumber" placeholder="XXXX XXXX XXXX" {...register('idProofNumber')} />
                {errors.idProofNumber && <p className="text-sm text-red-600">{errors.idProofNumber.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth (optional)</Label>
              <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting || createCustomer.isPending}>
                {isSubmitting || createCustomer.isPending ? 'Creating...' : 'Create Customer'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
