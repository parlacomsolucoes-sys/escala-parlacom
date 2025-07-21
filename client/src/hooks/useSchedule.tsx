// client/src/hooks/useSchedule.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getCurrentUserToken } from "@/lib/auth";
import type {
  Employee,
  Holiday,
  ScheduleEntry,
  InsertEmployee,
  InsertHoliday,
  InsertAssignment,
  MonthlySchedule,
  ScheduleDay,
} from "@shared/schema";

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

/** ESCALA MENSAL */
export function useSchedule(year: number, month: number) {
  return useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule", year, month],
    queryFn: async () => {
      const raw = await api.get<any>(`/api/schedule/${year}/${month}`);
      if (Array.isArray(raw)) {
        return raw as ScheduleDay[];
      }
      if (raw && Array.isArray(raw.days)) {
        return raw.days as ScheduleDay[];
      }
      throw new Error("Formato inesperado da resposta de /api/schedule");
    },
  });
}

export function useMonthlySchedule(year: number, month: number) {
  return useQuery<MonthlySchedule>({
    queryKey: ["/api/schedule-doc", year, month],
    queryFn: () =>
      api.get<MonthlySchedule>(`/api/schedule/${year}/${month}?full=1`),
  });
}

export function useGenerateMonthlySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) =>
      api.post<MonthlySchedule>(
        "/api/schedule/generate",
        { year, month },
        { headers: await withAuthHeaders() }
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["/api/schedule", vars.year, vars.month],
      });
      qc.invalidateQueries({
        queryKey: ["/api/schedule-doc", vars.year, vars.month],
      });
    },
  });
}

/** ATUALIZAÇÃO DE DIA ESPECÍFICO */
export function useUpdateDaySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      date,
      assignments,
    }: {
      date: string;
      assignments: InsertAssignment[];
    }) =>
      api.patch<ScheduleEntry>(
        `/api/schedule/day/${date}`,
        { assignments },
        { headers: await withAuthHeaders() }
      ),
    onSuccess: (_data, vars) => {
      const [yearStr, monthStr] = vars.date.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      qc.invalidateQueries({ queryKey: ["/api/schedule", year, month] });
      qc.invalidateQueries({ queryKey: ["/api/schedule-doc", year, month] });
    },
  });
}

/** EMPLOYEES */
export function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: () => api.get<Employee[]>("/api/employees"),
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertEmployee) =>
      api.post<Employee>("/api/employees", data, {
        headers: await withAuthHeaders(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/employees"] });
      // invalidate schedule so it refetches
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/schedule",
      });
    },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
    } & Partial<InsertEmployee>) =>
      api.patch<Employee>(`/api/employees/${id}`, data, {
        headers: await withAuthHeaders(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/employees"] });
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/schedule",
      });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      api.del(`/api/employees/${id}`, {
        headers: await withAuthHeaders(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/employees"] });
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/schedule",
      });
    },
  });
}

/** HOLIDAYS */
export function useHolidays() {
  return useQuery<Holiday[]>({
    queryKey: ["/api/holidays"],
    queryFn: () => api.get<Holiday[]>("/api/holidays"),
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertHoliday) =>
      api.post<Holiday>("/api/holidays", data, {
        headers: await withAuthHeaders(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/holidays"] });
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/schedule",
      });
    },
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      api.del(`/api/holidays/${id}`, {
        headers: await withAuthHeaders(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/holidays"] });
      qc.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "/api/schedule",
      });
    },
  });
}
