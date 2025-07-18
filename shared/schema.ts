import { z } from "zod";

// Employee schema
export const insertEmployeeSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  workDays: z.array(z.enum(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"])),
  defaultStartTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido"),
  defaultEndTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido"),
  isActive: z.boolean().default(true),
  weekendRotation: z.boolean().default(false),
  customSchedule: z.record(z.string(), z.object({
    startTime: z.string(),
    endTime: z.string()
  })).optional()
});

export const updateEmployeeSchema = insertEmployeeSchema.partial().extend({
  id: z.string()
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type UpdateEmployee = z.infer<typeof updateEmployeeSchema>;

export interface Employee extends InsertEmployee {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Holiday schema
export const insertHolidaySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  description: z.string().optional()
});

export const updateHolidaySchema = insertHolidaySchema.partial().extend({
  id: z.string()
});

export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type UpdateHoliday = z.infer<typeof updateHolidaySchema>;

export interface Holiday extends InsertHoliday {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Assignment schema
export const insertAssignmentSchema = z.object({
  employeeId: z.string(),
  employeeName: z.string(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido")
});

export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;

export interface Assignment extends InsertAssignment {
  id: string;
}

// Schedule Entry schema
export const insertScheduleEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  assignments: z.array(insertAssignmentSchema)
});

export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;

export interface ScheduleEntry extends InsertScheduleEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Monthly Schedule Generation Request
export const generateMonthlyScheduleSchema = z.object({
  year: z.number().min(2020).max(2030),
  month: z.number().min(1).max(12)
});

export type GenerateMonthlyScheduleRequest = z.infer<typeof generateMonthlyScheduleSchema>;

// Utility function to normalize time format
export function normalizeTime(time: string): string {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  
  const [, hours, minutes] = match;
  return `${hours.padStart(2, '0')}:${minutes}`;
}

// Utility function to check if date is weekend
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

// Utility function to check if date is holiday
export function isHoliday(date: Date, holidays: Holiday[]): Holiday | undefined {
  const dateString = date.toISOString().split('T')[0];
  return holidays.find(holiday => holiday.date === dateString);
}

// Utility function to get week number
export function getWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
