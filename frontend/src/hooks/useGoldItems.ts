import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, GoldItem } from '@/types';

export function useCreateGoldItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      customerId: string;
      description: string;
      weightGrams: number;
      purity: string;
      estimatedValuePaise: number;
      conditionNotes?: string;
    }) => {
      const { data } = await api.post<ApiResponse<GoldItem>>('/gold-items', payload);
      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers', variables.customerId] });
    },
  });
}
