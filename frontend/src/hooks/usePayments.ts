import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Payment, Receipt, ApiResponse } from '@/types';

export function useReceipt(id: string) {
  return useQuery({
    queryKey: ['receipts', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Receipt>>(`/receipts/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      loanId: string;
      paymentDate: string;
      totalAmountPaise: number;
      paymentMethod: string;
      referenceNumber?: string;
      notes?: string;
    }) => {
      const { data } = await api.post<ApiResponse<Payment>>('/payments', payload);
      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['loans', variables.loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
  });
}
