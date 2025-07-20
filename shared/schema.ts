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
        startTime: z.string(),
        endTime: z.string(),
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
 * HOLIDAYS (Suporta formato legado e novo)
 * =======================================================*/
const baseHolidaySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  date: z.string().optional(), // legado: "MM-DD" ou "YYYY-MM-DD"
  month: z.number().min(1).max(12).optional(), // novo
  day: z.number().min(1).max(31).optional(), // novo
  description: z.string().optional(),
});

export const insertHolidaySchema = baseHolidaySchema.transform((data) => {
  // Se veio 'date' e não tem month/day ainda:
  if (data.date && !data.month && !data.day) {
    const dateMatch = data.date.match(/^(\d{4}-)?(\d{2})-(\d{2})$/);
    if (dateMatch) {
      data.month = parseInt(dateMatch[2]);
      data.day = parseInt(dateMatch[3]);
      data.date = `${dateMatch[2]}-${dateMatch[3]}`; // normaliza para MM-DD
    }
  } else if (data.month && data.day) {
    const m = String(data.month).padStart(2, "0");
    const d = String(data.day).padStart(2, "0");
    data.date = `${m}-${d}`;
  }
  return data;
});

export const updateHolidaySchema = baseHolidaySchema.partial().extend({
  id: z.string(),
});

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
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
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
    z.object({
      id: z.string(),
      name: z.string(),
    }),
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
      lastWeekendIndex: z.number(),
    })
    .optional(),
  generatedAt: z.string(),
  updatedAt: z.string(),
  version: z.number().default(1),
});
export type MonthlySchedule = z.infer<typeof monthlyScheduleSchema>;

/* ---------------------------------------------------------
 * Compatibilidade: onde o front antigo esperava ScheduleEntry[]
 * agora cada ScheduleEntry = ScheduleDay
 * --------------------------------------------------------*/
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
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  const [, h, m] = match;
  return `${h.padStart(2, "0")}:${m}`;
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export function isHoliday(
  date: Date,
  holidays: Holiday[]
): Holiday | undefined {
  const targetMonth = date.getMonth() + 1;
  const targetDay = date.getDate();

  return holidays.find((holiday) => {
    if (holiday.month && holiday.day) {
      return holiday.month === targetMonth && holiday.day === targetDay;
    }
    if (holiday.date) {
      if (holiday.date.length === 5) {
        // MM-DD
        const [m, d] = holiday.date.split("-").map(Number);
        return m === targetMonth && d === targetDay;
      }
      // YYYY-MM-DD
      const iso = date.toISOString().split("T")[0];
      return holiday.date === iso;
    }
    return false;
  });
}

export function getWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
