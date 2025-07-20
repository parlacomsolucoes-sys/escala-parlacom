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

/* =========================================================
 * HELPER para injetar token quando necessário (mutations)
 * =======================================================*/
async function withAuthHeaders(): Promise<Record<string, string>> {
  const token = await getCurrentUserToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/* =========================================================
 * EMPLOYEES
 * =======================================================*/
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
    },
  });
}

/* =========================================================
 * HOLIDAYS
 * =======================================================*/
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
    },
  });
}

/* =========================================================
 * SCHEDULE (MENSAL)
 * =======================================================*/

/**
 * Retorna o array de dias (compat com código antigo que espera ScheduleEntry[]).
 * Backend agora retorna (ou pode retornar) o documento mensal (MonthlySchedule).
 * Ajuste se sua rota já retorna diretamente days:[]; se já retorna array, este adaptador não quebra.
 */
export function useSchedule(year: number, month: number) {
  return useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule", year, month],
    queryFn: async () => {
      // Espera: GET /api/schedule/:year/:month
      // Pode retornar: { year, month, days:[...] } OU diretamente days:[...]
      const raw = await api.get<any>(`/api/schedule/${year}/${month}`);
      if (Array.isArray(raw)) {
        // já é array (compat legado)
        return raw as ScheduleDay[];
      }
      if (raw && Array.isArray(raw.days)) {
        return raw.days as ScheduleDay[];
      }
      throw new Error("Formato inesperado da resposta de schedule");
    },
  });
}

/**
 * Se o front precisar do documento mensal completo (ex. rotationState),
 * use este hook adicional.
 */
export function useMonthlySchedule(year: number, month: number) {
  return useQuery<MonthlySchedule>({
    queryKey: ["/api/schedule-doc", year, month],
    queryFn: () =>
      api.get<MonthlySchedule>(`/api/schedule/${year}/${month}?full=1`),
  });
}

/* Geração mensal completa (se a rota existir) */
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

/* Geração só dos finais de semana */
export function useGenerateWeekendSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) =>
      api.post<ScheduleEntry[]>(
        "/api/schedule/generate-weekends",
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

/* Atualização de um dia específico */
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
      if (!isNaN(year) && !isNaN(month)) {
        qc.invalidateQueries({ queryKey: ["/api/schedule", year, month] });
        qc.invalidateQueries({ queryKey: ["/api/schedule-doc", year, month] });
      }
    },
  });
}

/* Utilitário opcional de fetch autorizado (quase nunca necessário) */
export async function authorizedFetch<T = unknown>(
  path: string,
  init?: RequestInit
) {
  const headers = await withAuthHeaders();
  const res = await fetch(
    path.startsWith("http")
      ? path
      : (import.meta.env.VITE_API_BASE_URL || "") + path,
    { ...init, headers: { ...headers, ...(init?.headers as any) } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}
