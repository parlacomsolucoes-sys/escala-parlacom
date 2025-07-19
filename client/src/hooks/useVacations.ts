import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentUserToken } from "@/lib/auth";
import type { Vacation, InsertVacation } from "@shared/schema";

// Vacations
export function useVacations(year: number, employeeId?: string) {
  return useQuery<Vacation[]>({
    queryKey: ["/api/vacations", year, employeeId],
    queryFn: async () => {
      const params = new URLSearchParams({ year: year.toString() });
      if (employeeId) {
        params.append('employeeId', employeeId);
      }
      
      const response = await fetch(`/api/vacations?${params}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }
      return response.json();
    },
  });
}

export function useCreateVacation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertVacation) => {
      const token = await getCurrentUserToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch("/api/vacations", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (newVacation: Vacation) => {
      // Invalidate vacations for the year
      queryClient.invalidateQueries({ queryKey: ["/api/vacations", newVacation.year] });
      
      // Invalidate schedule for affected months
      const startMonth = new Date(newVacation.startDate).getMonth() + 1;
      const endMonth = new Date(newVacation.endDate).getMonth() + 1;
      
      for (let month = startMonth; month <= endMonth; month++) {
        queryClient.invalidateQueries({ queryKey: ["/api/schedule", newVacation.year, month] });
      }
    },
  });
}

export function useUpdateVacation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<InsertVacation>) => {
      const token = await getCurrentUserToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/vacations/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (updatedVacation: Vacation) => {
      // Invalidate vacations for the year
      queryClient.invalidateQueries({ queryKey: ["/api/vacations", updatedVacation.year] });
      
      // Invalidate schedule for affected months
      const startMonth = new Date(updatedVacation.startDate).getMonth() + 1;
      const endMonth = new Date(updatedVacation.endDate).getMonth() + 1;
      
      for (let month = startMonth; month <= endMonth; month++) {
        queryClient.invalidateQueries({ queryKey: ["/api/schedule", updatedVacation.year, month] });
      }
    },
  });
}

export function useDeleteVacation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getCurrentUserToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/vacations/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all vacation queries (we don't know which year was affected)
      queryClient.invalidateQueries({ queryKey: ["/api/vacations"] });
      
      // Invalidate all schedule queries for current year
      const currentYear = new Date().getFullYear();
      for (let month = 1; month <= 12; month++) {
        queryClient.invalidateQueries({ queryKey: ["/api/schedule", currentYear, month] });
      }
    },
  });
}