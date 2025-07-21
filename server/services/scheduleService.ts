// src/services/scheduleService.ts

import { adminDb } from "../firebase-admin";
import type {
  Employee,
  Holiday,
  MonthlySchedule,
  ScheduleDay,
  Assignment,
} from "@shared/schema";
import {
  formatDate,
  getMonthDays,
  calcHolidayMap,
  isWeekend,
  isHolidayDate,
  pickEmployeeDefaultTimes,
  getMonthlyScheduleId,
  generateETag,
} from "@shared/utils/schedule";
import { normalizeTime } from "@shared/schema";
import { vacationService } from "./vacationService";

const scheduleCache = new Map<
  string,
  { data: MonthlySchedule; etag: string; ts: number }
>();
const CACHE_TTL_MS = 60_000;

const WEEKDAY_KEYS: Array<
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
> = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export class ScheduleService {
  private employeesCollection = adminDb.collection("employees");
  private holidaysCollection = adminDb.collection("holidays");
  private schedulesCollection = adminDb.collection("schedules");

  /** Clear *all* cached months so next fetch regenerates from scratch */
  clearCache() {
    scheduleCache.clear();
  }

  /* ================= EMPLOYEES ================= */

  /** Fetch all employees */
  async getAllEmployees(): Promise<Employee[]> {
    const snapshot = await this.employeesCollection.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Employee, "id">),
    })) as Employee[];
  }

  /**
   * Create a brand‑new employee, including optional notes,
   * and clear the schedule cache so the calendar picks up the new person.
   */
  async createEmployee(
    employee: Omit<Employee, "id" | "createdAt" | "updatedAt"> & {
      notes?: string;
    }
  ): Promise<Employee> {
    const docRef = this.employeesCollection.doc();
    const now = new Date().toISOString();

    const newEmployee: Employee = {
      id: docRef.id,
      name: employee.name,
      workDays: employee.workDays,
      defaultStartTime: employee.defaultStartTime,
      defaultEndTime: employee.defaultEndTime,
      isActive: employee.isActive,
      weekendRotation: employee.weekendRotation,
      customSchedule: employee.customSchedule,
      notes: employee.notes ?? "", // ← store notes
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(newEmployee);
    this.clearCache();
    return newEmployee;
  }

  /**
   * Update an existing employee — now including notes —
   * and clear the cache so the calendar and employee list refresh.
   */
  async updateEmployee(
    id: string,
    employee: Partial<Omit<Employee, "id" | "createdAt"> & { notes?: string }>
  ): Promise<Employee> {
    const docRef = this.employeesCollection.doc(id);
    const now = new Date().toISOString();

    // Build the update payload
    const updateData: Partial<Omit<Employee, "id">> = {
      ...employee,
      ...(employee.notes !== undefined ? { notes: employee.notes } : {}),
      updatedAt: now,
    };

    await docRef.update(updateData);

    const updatedSnap = await docRef.get();
    const updatedEmployee = updatedSnap.data() as Employee;

    this.clearCache();
    return { id: updatedEmployee.id, ...updatedEmployee };
  }

  /**
   * Delete an employee by ID and clear cache
   */
  async deleteEmployee(id: string): Promise<void> {
    await this.employeesCollection.doc(id).delete();
    this.clearCache();
  }

  /* ================= HOLIDAYS ================= */

  async getAllHolidays(): Promise<Holiday[]> {
    const snapshot = await this.holidaysCollection.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Holiday, "id">),
    })) as Holiday[];
  }

  async createHoliday(data: {
    name: string;
    date: string;
    description?: string;
  }): Promise<Holiday> {
    let mmdd = data.date;
    if (data.date.length === 10 && data.date.includes("-")) {
      mmdd = data.date.substring(5);
    }
    const [mStr, dStr] = mmdd.split("-");
    const month = parseInt(mStr, 10);
    const day = parseInt(dStr, 10);

    const docRef = this.holidaysCollection.doc();
    const now = new Date().toISOString();
    const newHoliday: Holiday = {
      id: docRef.id,
      name: data.name,
      date: mmdd,
      description: data.description,
      month,
      day,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(newHoliday);
    this.clearCache();
    return newHoliday;
  }

  async deleteHoliday(id: string): Promise<void> {
    await this.holidaysCollection.doc(id).delete();
    this.clearCache();
  }

  /* ================= SCHEDULE ================= */

  /**
   * Fetch or generate the monthly schedule.
   * If forceRegenerate is true, always rebuild and overwrite Firestore.
   */
  async getScheduleForMonth(
    year: number,
    month: number,
    etag?: string,
    forceRegenerate = false
  ): Promise<{ schedule: ScheduleDay[]; etag: string; fromCache: boolean }> {
    const docId = getMonthlyScheduleId(year, month);

    if (!forceRegenerate) {
      const cached = scheduleCache.get(docId);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        if (etag && etag === cached.etag) {
          throw new Error("NOT_MODIFIED");
        }
        return {
          schedule: cached.data.days,
          etag: cached.etag,
          fromCache: true,
        };
      }
    }

    const docRef = this.schedulesCollection.doc(docId);
    const snap = await docRef.get();

    let monthlySchedule: MonthlySchedule;
    if (!snap.exists || forceRegenerate) {
      monthlySchedule = await this.createMonthlySchedule(year, month);
      await docRef.set(monthlySchedule);
    } else {
      monthlySchedule = snap.data() as MonthlySchedule;
    }

    const newEtag = generateETag(monthlySchedule);
    scheduleCache.set(docId, {
      data: monthlySchedule,
      etag: newEtag,
      ts: Date.now(),
    });

    return {
      schedule: monthlySchedule.days,
      etag: newEtag,
      fromCache: false,
    };
  }

  /** Construct a brand‑new schedule from scratch */
  private async createMonthlySchedule(
    year: number,
    month: number
  ): Promise<MonthlySchedule> {
    const holidays = await this.getAllHolidays();
    const holidayMap = calcHolidayMap(holidays);

    const vacationMap = await vacationService.getEmployeesOnVacationForMonth(
      year,
      month
    );
    const employees = await this.getAllEmployees();
    const monthDays = getMonthDays(year, month);

    const days: ScheduleDay[] = monthDays.map((date) => {
      const dateStr = formatDate(date);
      const weekend = isWeekend(date);
      const holiday = isHolidayDate(date, holidayMap);
      const onVacationEmployeeIds = Array.from(vacationMap.get(dateStr) || []);

      const base: ScheduleDay = {
        date: dateStr,
        assignments: [],
        isWeekend: weekend,
        isHoliday: holiday,
      };
      if (onVacationEmployeeIds.length > 0) {
        base.onVacationEmployeeIds = onVacationEmployeeIds;
      }
      return base;
    });

    // --- WEEKEND ROTATION ---
    const weekendEmployees = employees
      .filter((e) => e.isActive && e.weekendRotation)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Pull lastSwap from previous month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevSnap = await this.schedulesCollection
      .doc(getMonthlyScheduleId(prevYear, prevMonth))
      .get()
      .catch(() => null);

    const prevSchedule = prevSnap?.exists
      ? (prevSnap.data() as MonthlySchedule)
      : null;
    let swap = prevSchedule?.rotationState?.lastSwap ?? false;

    for (const day of days) {
      const idx = new Date(day.date).getDay(); // 0=domingo,6=sábado
      const onVac = day.onVacationEmployeeIds || [];

      // Weekend
      if (day.isWeekend && weekendEmployees.length >= 2) {
        const [A, B] = weekendEmployees;
        const emp = (idx === 6) === swap ? A : B;
        if (!onVac.includes(emp.id)) {
          const times = pickEmployeeDefaultTimes(emp, idx);
          day.assignments.push({
            id: `${emp.id}-${day.date}`,
            employeeId: emp.id,
            employeeName: emp.name,
            startTime: normalizeTime(times.startTime),
            endTime: normalizeTime(times.endTime),
          });
        }
        if (idx === 0) {
          swap = !swap;
        }
      }
      // Weekday
      else if (!day.isWeekend && !day.isHoliday) {
        const key = WEEKDAY_KEYS[new Date(day.date).getDay()];
        const available = employees.filter(
          (e) =>
            e.isActive &&
            e.workDays.includes(key) &&
            !(day.onVacationEmployeeIds || []).includes(e.id)
        );
        for (const emp of available) {
          const times = pickEmployeeDefaultTimes(
            emp,
            new Date(day.date).getDay()
          );
          day.assignments.push({
            id: `${emp.id}-${day.date}`,
            employeeId: emp.id,
            employeeName: emp.name,
            startTime: normalizeTime(times.startTime),
            endTime: normalizeTime(times.endTime),
          });
        }
      }
    }

    const now = new Date().toISOString();
    return {
      year,
      month,
      days,
      rotationState: { lastSwap: swap },
      generatedAt: now,
      updatedAt: now,
      version: 1,
    };
  }

  /** Manually update assignments of a single day */
  async updateDaySchedule(
    date: string,
    assignments: Assignment[]
  ): Promise<ScheduleDay> {
    const [yearString, monthString] = date.split("-");
    const year = parseInt(yearString, 10);
    const month = parseInt(monthString, 10);
    const docId = getMonthlyScheduleId(year, month);

    const docRef = this.schedulesCollection.doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new Error(`Schedule not found for ${docId}`);
    }

    const monthlySchedule = snap.data() as MonthlySchedule;
    const idx = monthlySchedule.days.findIndex((d) => d.date === date);
    if (idx === -1) {
      throw new Error(`Day ${date} not found in schedule`);
    }

    for (const a of assignments) {
      if (await vacationService.isEmployeeOnVacation(a.employeeId, date)) {
        throw new Error("Funcionário em férias neste dia");
      }
    }

    monthlySchedule.days[idx].assignments = assignments;
    monthlySchedule.updatedAt = new Date().toISOString();
    await docRef.set(monthlySchedule);
    scheduleCache.delete(docId);
    return monthlySchedule.days[idx];
  }
}

export const scheduleService = new ScheduleService();
