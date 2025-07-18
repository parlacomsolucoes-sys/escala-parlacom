import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentUserToken } from "@/lib/auth";
import type {
  Employee,
  Holiday,
  ScheduleEntry,
  InsertEmployee,
  InsertHoliday,
  InsertAssignment,
} from "@shared/schema";

// Employees
export function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertEmployee) => {
      const token = await getCurrentUserToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch("/api/employees", {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: string } & Partial<InsertEmployee>) => {
      const token = await getCurrentUserToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/employees/${id}`, {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getCurrentUserToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      // ✅ Firestore API devolve 204 – não há corpo para converter
      if (response.status === 204) return null;

      // Se algum dia mudarmos para 200+json, ainda funciona
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    },
  });
}

// Holidays
export function useHolidays() {
  return useQuery<Holiday[]>({
    queryKey: ["/api/holidays"],
  });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertHoliday) => {
      const token = await getCurrentUserToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch("/api/holidays", {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
    },
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getCurrentUserToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/holidays/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
    },
  });
}

// Schedule
export function useSchedule(year: number, month: number) {
  return useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule", year, month],
    queryFn: async () => {
      const response = await fetch(`/api/schedule/${year}/${month}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }
      return response.json();
    },
  });
}

export function useGenerateMonthlySchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      const token = await getCurrentUserToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch("/api/schedule/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ year, month }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/schedule", variables.year, variables.month],
      });
    },
  });
}

// PHASE 5: Weekend schedule generation hook
export function useGenerateWeekendSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      const token = await getCurrentUserToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch("/api/schedule/generate-weekends", {
        method: "POST",
        headers,
        body: JSON.stringify({ year, month }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/schedule", variables.year, variables.month],
      });
    },
  });
}

export function useUpdateDaySchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      date,
      assignments,
    }: {
      date: string;
      assignments: InsertAssignment[];
    }) => {
      const token = await getCurrentUserToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/schedule/day/${date}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ assignments }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      const [year, month] = variables.date.split("-").map(Number);
      queryClient.invalidateQueries({
        queryKey: ["/api/schedule", year, month],
      });
    },
  });
}
