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

// In-memory cache for schedules
const scheduleCache = new Map<
  string,
  { data: MonthlySchedule; etag: string; ts: number }
>();
const CACHE_TTL_MS = 60_000; // 60 seconds

export class ScheduleService {
  private employeesCollection = adminDb.collection("employees");
  private holidaysCollection = adminDb.collection("holidays");
  private schedulesCollection = adminDb.collection("schedules"); // New collection for monthly docs

  // Employee CRUD operations
  async getAllEmployees(): Promise<Employee[]> {
    const snapshot = await this.employeesCollection.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Employee[];
  }

  async createEmployee(
    employee: Omit<Employee, "id" | "createdAt" | "updatedAt">
  ): Promise<Employee> {
    const docRef = this.employeesCollection.doc();
    const newEmployee: Employee = {
      id: docRef.id,
      ...employee,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(newEmployee);
    return newEmployee;
  }

  async updateEmployee(
    id: string,
    employee: Partial<Omit<Employee, "id" | "createdAt">>
  ): Promise<Employee> {
    const docRef = this.employeesCollection.doc(id);
    const updateData = {
      ...employee,
      updatedAt: new Date().toISOString(),
    };

    await docRef.update(updateData);
    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as Employee;
  }

  async deleteEmployee(id: string): Promise<void> {
    await this.employeesCollection.doc(id).delete();
  }

  // Holiday CRUD operations
  async getAllHolidays(): Promise<Holiday[]> {
    const snapshot = await this.holidaysCollection.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Holiday[];
  }

  async createHoliday(data: {
    name: string;
    date: string;
    description?: string;
  }): Promise<Holiday> {
    // Normalize date to MM-DD format
    let mmddDate = data.date;
    if (data.date.length === 10 && data.date.includes("-")) {
      mmddDate = data.date.substring(5); // Extract MM-DD from YYYY-MM-DD
    }

    const [monthStr, dayStr] = mmddDate.split("-");
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    const docRef = this.holidaysCollection.doc();
    const newHoliday: Holiday = {
      id: docRef.id,
      name: data.name,
      date: mmddDate,
      description: data.description,
      month,
      day,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(newHoliday);
    return newHoliday;
  }

  async deleteHoliday(id: string): Promise<void> {
    await this.holidaysCollection.doc(id).delete();
  }

  // NEW: Monthly schedule operations
  async getScheduleForMonth(
    year: number,
    month: number,
    etag?: string,
    forceRegenerate: boolean = false
  ): Promise<{ schedule: ScheduleDay[]; etag: string; fromCache: boolean }> {
    const docId = getMonthlyScheduleId(year, month);

    // Check cache first (if not forcing regeneration)
    if (!forceRegenerate) {
      const cached = scheduleCache.get(docId);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        // Check ETag
        if (etag && etag === cached.etag) {
          console.log(`[SCHEDULE] Cache HIT + ETag match for ${docId}`);
          throw new Error("NOT_MODIFIED"); // Will be handled as 304
        }
        console.log(`[SCHEDULE] Cache HIT for ${docId}`);
        return {
          schedule: cached.data.days,
          etag: cached.etag,
          fromCache: true,
        };
      }
    }

    console.log(`[SCHEDULE] Cache MISS for ${docId}, loading from Firestore`);

    // Try to load from Firestore
    const docRef = this.schedulesCollection.doc(docId);
    const doc = await docRef.get();

    let monthlySchedule: MonthlySchedule;

    if (!doc.exists || forceRegenerate) {
      // Create new monthly schedule
      console.log(`[SCHEDULE] Creating new monthly schedule for ${docId}`);
      monthlySchedule = await this.createMonthlySchedule(year, month);
      await docRef.set(monthlySchedule);
    } else {
      monthlySchedule = doc.data() as MonthlySchedule;
    }

    // Generate ETag and cache
    const newEtag = generateETag(monthlySchedule);
    scheduleCache.set(docId, {
      data: monthlySchedule,
      etag: newEtag,
      ts: Date.now(),
    });

    console.log(
      `[SCHEDULE] Loaded ${monthlySchedule.days.length} days for ${docId}`
    );
    return { schedule: monthlySchedule.days, etag: newEtag, fromCache: false };
  }

  private async createMonthlySchedule(
    year: number,
    month: number
  ): Promise<MonthlySchedule> {
    // Load all holidays and vacation data
    const holidays = await this.getAllHolidays();
    const holidayMap = calcHolidayMap(holidays);
    const vacationMap = await vacationService.getEmployeesOnVacationForMonth(
      year,
      month
    );

    // Generate all days for the month
    const monthDays = getMonthDays(year, month);
    const days: ScheduleDay[] = monthDays.map((date) => {
      const dateStr = formatDate(date);
      const weekend = isWeekend(date);
      const holiday = isHolidayDate(date, holidayMap);
      const onVacationEmployeeIds = Array.from(vacationMap.get(dateStr) || []);

      return {
        date: dateStr,
        assignments: [],
        isWeekend: weekend,
        isHoliday: holiday,
        onVacationEmployeeIds:
          onVacationEmployeeIds.length > 0 ? onVacationEmployeeIds : undefined,
      };
    });

    return {
      year,
      month,
      days,
      rotationState: { lastWeekendIndex: 0 },
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }

  async generateWeekendSchedule(
    year: number,
    month: number
  ): Promise<{
    message: string;
    daysUpdated: number;
    rotationState: { lastWeekendIndex: number };
  }> {
    console.log(`[WEEKEND] Generating weekend schedule for ${month}/${year}`);

    // Get active employees with weekend rotation
    const employees = await this.getAllEmployees();
    const weekendEmployees = employees
      .filter((emp) => emp.weekendRotation && emp.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (weekendEmployees.length === 0) {
      return {
        message: "No employees available for weekend rotation",
        daysUpdated: 0,
        rotationState: { lastWeekendIndex: 0 },
      };
    }

    // Load monthly schedule
    const docId = getMonthlyScheduleId(year, month);
    const docRef = this.schedulesCollection.doc(docId);

    let monthlySchedule: MonthlySchedule;
    const doc = await docRef.get();

    if (!doc.exists) {
      monthlySchedule = await this.createMonthlySchedule(year, month);
    } else {
      monthlySchedule = doc.data() as MonthlySchedule;
    }

    // Process weekend days
    let daysUpdated = 0;
    let currentIndex = monthlySchedule.rotationState?.lastWeekendIndex || 0;

    for (const day of monthlySchedule.days) {
      if (day.isWeekend && !day.isHoliday) {
        // Find next available employee (not on vacation)
        let attempts = 0;
        let employee = null;

        while (attempts < weekendEmployees.length) {
          const candidateEmployee =
            weekendEmployees[currentIndex % weekendEmployees.length];
          const isOnVacation =
            day.onVacationEmployeeIds?.includes(candidateEmployee.id) || false;

          if (!isOnVacation) {
            employee = candidateEmployee;
            break;
          }

          currentIndex++;
          attempts++;
        }

        if (employee) {
          const date = new Date(day.date);
          const weekdayIndex = date.getDay();
          const times = pickEmployeeDefaultTimes(employee, weekdayIndex);

          // Remove existing weekend assignments and add new one
          day.assignments = day.assignments.filter(
            (a) => !weekendEmployees.some((we) => we.id === a.employeeId)
          );

          day.assignments.push({
            id: `${employee.id}-${day.date}`,
            employeeId: employee.id,
            employeeName: employee.name,
            startTime: normalizeTime(times.startTime),
            endTime: normalizeTime(times.endTime),
          });

          currentIndex++;
          daysUpdated++;
        }
        // If no employee available (all on vacation), skip this weekend day
      }
    }

    // Update rotation state and save
    monthlySchedule.rotationState = { lastWeekendIndex: currentIndex };
    monthlySchedule.updatedAt = new Date().toISOString();

    await docRef.set(monthlySchedule);

    // Invalidate cache
    scheduleCache.delete(docId);

    console.log(`[WEEKEND] Updated ${daysUpdated} weekend days`);

    return {
      message: `Updated ${daysUpdated} weekend days with rotation`,
      daysUpdated,
      rotationState: monthlySchedule.rotationState,
    };
  }

  async updateDaySchedule(
    date: string,
    assignments: Assignment[]
  ): Promise<ScheduleDay> {
    console.log(`[SCHEDULE] Updating day schedule for ${date}`);

    // Parse year and month from date
    const [year, month] = date.split("-").map(Number);
    const docId = getMonthlyScheduleId(year, month);

    const docRef = this.schedulesCollection.doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`Schedule not found for ${docId}`);
    }

    const monthlySchedule = doc.data() as MonthlySchedule;
    const dayIndex = monthlySchedule.days.findIndex((d) => d.date === date);

    if (dayIndex === -1) {
      throw new Error(`Day ${date} not found in schedule`);
    }

    // Validate assignments
    for (const assignment of assignments) {
      if (
        !assignment.employeeId ||
        !assignment.employeeName ||
        !assignment.startTime ||
        !assignment.endTime
      ) {
        throw new Error("Assignment missing required fields");
      }
      // Validate time format
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (
        !timeRegex.test(assignment.startTime) ||
        !timeRegex.test(assignment.endTime)
      ) {
        throw new Error("Invalid time format");
      }

      // Check if employee is on vacation for this date
      const isOnVacation = await vacationService.isEmployeeOnVacation(
        assignment.employeeId,
        date
      );
      if (isOnVacation) {
        throw new Error("Funcionário em férias neste dia");
      }
    }

    // Update the day
    monthlySchedule.days[dayIndex].assignments = assignments;
    monthlySchedule.updatedAt = new Date().toISOString();

    await docRef.set(monthlySchedule);

    // Invalidate cache
    scheduleCache.delete(docId);

    console.log(
      `[SCHEDULE] Updated ${assignments.length} assignments for ${date}`
    );

    return monthlySchedule.days[dayIndex];
  }

  // Legacy compatibility method
  async updateDayScheduleOld(
    date: string,
    assignments: Assignment[]
  ): Promise<ScheduleDay> {
    return this.updateDaySchedule(date, assignments);
  }
}

export const scheduleService = new ScheduleService();
