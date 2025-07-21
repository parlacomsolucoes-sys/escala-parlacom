// src/shared/schema.ts

import { z } from "zod";

/* =========================================================
 * EMPLOYEES
 * =======================================================*/
export const insertEmployeeSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  workDays: z.array(
    z.enum([
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ])
  ),
  defaultStartTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido"),
  defaultEndTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido"),
  isActive: z.boolean().default(true),
  weekendRotation: z.boolean().default(false),
  customSchedule: z
    .record(
      z.string(),
      z.object({
        startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      })
    )
    .optional(),
});

export const updateEmployeeSchema = insertEmployeeSchema.partial().extend({
  id: z.string(),
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type UpdateEmployee = z.infer<typeof updateEmployeeSchema>;

export interface Employee extends InsertEmployee {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/* =========================================================
 * HOLIDAYS
 * =======================================================*/
const baseHolidaySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  date: z.string().optional(), // legacy "MM-DD" or "YYYY-MM-DD"
  month: z.number().min(1).max(12).optional(),
  day: z.number().min(1).max(31).optional(),
  description: z.string().optional(),
});

export const insertHolidaySchema = baseHolidaySchema.transform((data) => {
  if (data.date && !data.month && !data.day) {
    const m =
      data.date.length === 10 && data.date.includes("-")
        ? data.date.substring(5, 7)
        : data.date.split("-")[0];
    const d =
      data.date.length === 10 && data.date.includes("-")
        ? data.date.substring(8, 10)
        : data.date.split("-")[1];
    data.month = parseInt(m, 10);
    data.day = parseInt(d, 10);
    data.date = `${m}-${d}`;
  } else if (data.month && data.day) {
    const mm = String(data.month).padStart(2, "0");
    const dd = String(data.day).padStart(2, "0");
    data.date = `${mm}-${dd}`;
  }
  return data;
});

export const updateHolidaySchema = baseHolidaySchema
  .partial()
  .extend({ id: z.string() });

export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type UpdateHoliday = z.infer<typeof updateHolidaySchema>;

export interface Holiday extends InsertHoliday {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/* =========================================================
 * ASSIGNMENTS
 * =======================================================*/
export const assignmentSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeName: z.string(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido"),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido"),
});
export type Assignment = z.infer<typeof assignmentSchema>;

export const insertAssignmentSchema = assignmentSchema.omit({ id: true });
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;

/* =========================================================
 * DAILY (ScheduleDay)
 * =======================================================*/
export const scheduleDaySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  assignments: z.array(assignmentSchema),
  isWeekend: z.boolean(),
  isHoliday: z.union([
    z.object({ id: z.string(), name: z.string() }),
    z.null(),
  ]),
  onVacationEmployeeIds: z.array(z.string()).optional(),
});
export type ScheduleDay = z.infer<typeof scheduleDaySchema>;

/* =========================================================
 * MONTHLY (Documento consolidado)
 * =======================================================*/
export const monthlyScheduleSchema = z.object({
  year: z.number(),
  month: z.number().min(1).max(12),
  days: z.array(scheduleDaySchema),
  rotationState: z
    .object({
      lastSwap: z.boolean(),
    })
    .optional(),
  generatedAt: z.string(),
  updatedAt: z.string(),
  version: z.number().default(1),
});
export type MonthlySchedule = z.infer<typeof monthlyScheduleSchema>;

/* =========================================================
 * REQUESTS
 * =======================================================*/

// Body for POST /api/schedule/generate
export const generateMonthlyScheduleSchema = z.object({
  year: z.number().min(2020).max(2030),
  month: z.number().min(1).max(12),
});
export type GenerateMonthlyScheduleRequest = z.infer<
  typeof generateMonthlyScheduleSchema
>;

/* =========================================================
 * COMPAT: ScheduleEntry for legacy front
 * =======================================================*/
export type ScheduleEntry = ScheduleDay;

/* =========================================================
 * VACATION
 * =======================================================*/
export const vacationSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeName: z.string(),
  year: z.number(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD esperado"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD esperado"),
  createdAt: z.string(),
  updatedAt: z.string(),
  notes: z.string().optional(),
});
export const insertVacationSchema = vacationSchema.omit({
  id: true,
  employeeName: true,
  year: true,
  createdAt: true,
  updatedAt: true,
});
export const updateVacationSchema = insertVacationSchema.partial();
export type Vacation = z.infer<typeof vacationSchema>;
export type InsertVacation = z.infer<typeof insertVacationSchema>;

/* =========================================================
 * UTILITÁRIOS
 * =======================================================*/
export function normalizeTime(time: string): string {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return time;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export function isHoliday(
  date: Date,
  holidays: Holiday[]
): Holiday | undefined {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return holidays.find((h) => {
    if (h.month && h.day) return h.month === m && h.day === d;
    if (h.date?.length === 5) {
      const [mm, dd] = h.date.split("-").map(Number);
      return mm === m && dd === d;
    }
    if (h.date?.length === 10) {
      return h.date === date.toISOString().split("T")[0];
    }
    return false;
  });
}

export function getWeekNumber(date: Date): number {
  const target = new Date(date);
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
