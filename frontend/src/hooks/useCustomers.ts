import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Customer, ApiResponse, PaginatedResponse } from '@/types';

interface CustomersParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useCustomers(params: CustomersParams = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Customer>>('/customers', { params });
      return data;
    },
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Customer & { loans: unknown[]; goldItems: unknown[] }>>(`/customers/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Customer, 'id' | 'isActive' | 'createdAt' | 'createdById'>) => {
      const { data } = await api.post<ApiResponse<Customer>>('/customers', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
