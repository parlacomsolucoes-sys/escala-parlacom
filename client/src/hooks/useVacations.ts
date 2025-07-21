// client/src/hooks/useVacations.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getCurrentUserToken } from "@/lib/auth";
import type { Vacation, InsertVacation } from "@shared/schema";

/** Helper para injetar token */
async function withAuthHeaders(): Promise<Record<string, string>> {
  const token = await getCurrentUserToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** LISTAR férias por ano, opcionalmente por funcionário */
export function useVacations(year: number, employeeId?: string) {
  const key = employeeId
    ? ["/api/vacations", year, employeeId]
    : ["/api/vacations", year];
  return useQuery<Vacation[]>({
    queryKey: key,
    queryFn: () =>
      api.get<Vacation[]>(
        employeeId
          ? `/api/vacations?year=${year}&employeeId=${employeeId}`
          : `/api/vacations?year=${year}`
      ),
  });
}

/** CRIAR férias */
export function useCreateVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertVacation & { employeeName: string }) =>
      api.post<Vacation>("/api/vacations", data, {
        headers: await withAuthHeaders(),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/vacations"] });
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/schedule",
      });
    },
  });
}

/** ATUALIZAR férias */
export function useUpdateVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: string } & Partial<InsertVacation>) =>
      api.patch<Vacation>(`/api/vacations/${id}`, data, {
        headers: await withAuthHeaders(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vacations"] });
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/schedule",
      });
    },
  });
}

/** EXCLUIR férias */
export function useDeleteVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      api.del(`/api/vacations/${id}`, {
        headers: await withAuthHeaders(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vacations"] });
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/schedule",
      });
    },
  });
}
