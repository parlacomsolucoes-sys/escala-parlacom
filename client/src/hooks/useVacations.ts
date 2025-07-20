// client/src/hooks/useVacations.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getCurrentUserToken } from "@/lib/auth";
import type { Vacation, InsertVacation } from "@shared/schema";

async function authHeaders() {
  const token = await getCurrentUserToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function useVacations(year: number, employeeId?: string) {
  return useQuery<Vacation[]>({
    queryKey: ["/api/vacations", year, employeeId || "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ year: String(year) });
      if (employeeId) params.set("employeeId", employeeId);
      return api.get<Vacation[]>(`/api/vacations?${params.toString()}`);
    },
  });
}

export function useCreateVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertVacation) =>
      api.post<Vacation>("/api/vacations", data, {
        headers: await authHeaders(),
      }),
    onSuccess: (vac) => {
      qc.invalidateQueries({ queryKey: ["/api/vacations", vac.year] });
      const start = new Date(vac.startDate).getMonth() + 1;
      const end = new Date(vac.endDate).getMonth() + 1;
      for (let m = start; m <= end; m++) {
        qc.invalidateQueries({ queryKey: ["/api/schedule", vac.year, m] });
        qc.invalidateQueries({ queryKey: ["/api/schedule-doc", vac.year, m] });
      }
    },
  });
}

export function useUpdateVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
    } & Partial<InsertVacation>) =>
      api.patch<Vacation>(`/api/vacations/${id}`, data, {
        headers: await authHeaders(),
      }),
    onSuccess: (vac) => {
      qc.invalidateQueries({ queryKey: ["/api/vacations", vac.year] });
      const start = new Date(vac.startDate).getMonth() + 1;
      const end = new Date(vac.endDate).getMonth() + 1;
      for (let m = start; m <= end; m++) {
        qc.invalidateQueries({ queryKey: ["/api/schedule", vac.year, m] });
        qc.invalidateQueries({ queryKey: ["/api/schedule-doc", vac.year, m] });
      }
    },
  });
}

export function useDeleteVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      api.del(`/api/vacations/${id}`, { headers: await authHeaders() }),
    onSuccess: () => {
      // Mais simples: invalidar tudo de férias e escalas do ano corrente
      const year = new Date().getFullYear();
      qc.invalidateQueries({ queryKey: ["/api/vacations"] });
      for (let m = 1; m <= 12; m++) {
        qc.invalidateQueries({ queryKey: ["/api/schedule", year, m] });
        qc.invalidateQueries({ queryKey: ["/api/schedule-doc", year, m] });
      }
    },
  });
}
