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

  /* ================= EMPLOYEES ================= */
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
    const now = new Date().toISOString();
    const newEmployee: Employee = {
      id: docRef.id,
      ...employee,
      createdAt: now,
      updatedAt: now,
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

  /* ================= HOLIDAYS ================= */
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
    let mmddDate = data.date;
    if (data.date.length === 10 && data.date.includes("-")) {
      mmddDate = data.date.substring(5);
    }
    const [mStr, dStr] = mmddDate.split("-");
    const month = parseInt(mStr, 10);
    const day = parseInt(dStr, 10);

    const docRef = this.holidaysCollection.doc();
    const now = new Date().toISOString();
    const newHoliday: Holiday = {
      id: docRef.id,
      name: data.name,
      date: mmddDate,
      description: data.description,
      month,
      day,
      createdAt: now,
      updatedAt: now,
    };
    await docRef.set(newHoliday);
    return newHoliday;
  }

  async deleteHoliday(id: string): Promise<void> {
    await this.holidaysCollection.doc(id).delete();
  }

  /* ================= SCHEDULE ================= */
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
      return {
        date: dateStr,
        assignments: [],
        isWeekend: weekend,
        isHoliday: holiday,
        ...(onVacationEmployeeIds.length > 0 ? { onVacationEmployeeIds } : {}),
      };
    });

    // Seleciona funcionários para revezamento
    const weekendEmployees = employees.filter(
      (e) => e.isActive && e.weekendRotation
    );
    weekendEmployees.sort((a, b) => a.name.localeCompare(b.name));

    // Estado anterior de swap
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

    // Aplicar escala diária
    for (const day of days) {
      const dateObj = new Date(day.date);
      const dkey = dateObj.getDay(); // 0 dom,6 sáb
      const weekday = WEEKDAY_KEYS[dkey];
      const onVacation = day.onVacationEmployeeIds || [];

      if (!day.isWeekend && !day.isHoliday) {
        // Dias úteis: todos os ativos com workDays
        const avail = employees.filter(
          (e) =>
            e.isActive &&
            e.workDays.includes(weekday) &&
            !onVacation.includes(e.id)
        );
        for (const emp of avail) {
          const times = pickEmployeeDefaultTimes(emp, dkey);
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

    // Revezamento fim de semana
    if (weekendEmployees.length >= 2) {
      const [empA, empB] = weekendEmployees;
      for (const day of days) {
        if (!day.isWeekend || day.isHoliday) continue;
        const dateObj = new Date(day.date);
        const dow = dateObj.getDay();
        const onVacation = day.onVacationEmployeeIds || [];
        let assignedEmp: Employee | null = null;
        if (dow === 6) {
          // sábado
          assignedEmp = swap ? empB : empA;
        } else if (dow === 0) {
          // domingo
          assignedEmp = swap ? empA : empB;
        }
        if (assignedEmp && !onVacation.includes(assignedEmp.id)) {
          const times = pickEmployeeDefaultTimes(assignedEmp, dow);
          day.assignments.push({
            id: `${assignedEmp.id}-${day.date}`,
            employeeId: assignedEmp.id,
            employeeName: assignedEmp.name,
            startTime: normalizeTime(times.startTime),
            endTime: normalizeTime(times.endTime),
          });
        }
        // após domingo, inverter swap
        if (dow === 0) {
          swap = !swap;
        }
      }
    }

    // Contabilizar e persistir swap atual
    const total = days.reduce((sum, d) => sum + d.assignments.length, 0);
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

  async updateDaySchedule(
    date: string,
    assignments: Assignment[]
  ): Promise<ScheduleDay> {
    const [yStr, mStr] = date.split("-");
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const docId = getMonthlyScheduleId(year, month);
    const docRef = this.schedulesCollection.doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Schedule not found for ${docId}`);
    const sched = snap.data() as MonthlySchedule;
    const idx = sched.days.findIndex((d) => d.date === date);
    if (idx < 0) throw new Error(`Day ${date} not found`);
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const a of assignments) {
      if (!a.employeeId || !a.employeeName || !a.startTime || !a.endTime)
        throw new Error("Assignment missing required fields");
      if (!timeRe.test(a.startTime) || !timeRe.test(a.endTime))
        throw new Error("Invalid time format");
      const onVac = await vacationService.isEmployeeOnVacation(
        a.employeeId,
        date
      );
      if (onVac) throw new Error("Funcionário em férias neste dia");
    }
    sched.days[idx].assignments = assignments;
    sched.updatedAt = new Date().toISOString();
    await docRef.set(sched);
    scheduleCache.delete(docId);
    return sched.days[idx];
  }
}

export const scheduleService = new ScheduleService();
