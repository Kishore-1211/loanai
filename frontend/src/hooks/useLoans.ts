import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Loan, ApiResponse, PaginatedResponse, LoanStatus } from '@/types';

interface LoansParams {
  status?: LoanStatus | '';
  page?: number;
  pageSize?: number;
  customerId?: string;
}

export function useLoans(params: LoansParams = {}) {
  return useQuery({
    queryKey: ['loans', params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Loan>>('/loans', { params });
      return data;
    },
  });
}

export function useLoan(id: string) {
  return useQuery({
    queryKey: ['loans', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Loan>>(`/loans/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      customerId: string;
      goldItemIds: string[];
      principalPaise: number;
      monthlyRateBps: number;
      tenureMonths: number;
      startDate: string;
      interestType: string;
    }) => {
      const { data } = await api.post<ApiResponse<Loan>>('/loans', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
  });
}

export function useOverdueLoans() {
  return useQuery({
    queryKey: ['loans', 'overdue'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Loan[] }>('/reports/overdue');
      return data.data;
    },
  });
}

export function useDueSoonLoans() {
  return useQuery({
    queryKey: ['loans', 'due-soon'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Loan[] }>('/loans/due-soon');
      return data.data;
    },
  });
}
