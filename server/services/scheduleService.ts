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
  private clearCache() {
    scheduleCache.clear();
  }

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

    // clear any existing schedule so on next GET it's rebuilt
    this.clearCache();
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

    this.clearCache();
    return { id: doc.id, ...doc.data() } as Employee;
  }

  async deleteEmployee(id: string): Promise<void> {
    await this.employeesCollection.doc(id).delete();
    this.clearCache();
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

    this.clearCache();
    return newHoliday;
  }

  async deleteHoliday(id: string): Promise<void> {
    await this.holidaysCollection.doc(id).delete();
    this.clearCache();
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

    // --- WEEKEND ROTATION LOGIC ---
    const weekendEmployees = employees
      .filter((e) => e.isActive && e.weekendRotation)
      .sort((a, b) => a.name.localeCompare(b.name));

    // pull lastSwap from previous month if present
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
      const idx = new Date(day.date).getDay(); // 0 = Sunday, 6 = Saturday
      const onVacation = day.onVacationEmployeeIds || [];

      if (day.isWeekend && weekendEmployees.length >= 2) {
        // Saturday (6) and Sunday (0)
        const [A, B] = weekendEmployees;
        // if Saturday: weekdayIndex === 6
        // emp = (6 === 6) === swap ? A : B
        const emp = (idx === 6) === swap ? A : B;
        if (!onVacation.includes(emp.id)) {
          const times = pickEmployeeDefaultTimes(emp, idx);
          day.assignments.push({
            id: `${emp.id}-${day.date}`,
            employeeId: emp.id,
            employeeName: emp.name,
            startTime: normalizeTime(times.startTime),
            endTime: normalizeTime(times.endTime),
          });
        }
        // only flip swap after Sunday
        if (idx === 0) swap = !swap;
      } else if (!day.isWeekend && !day.isHoliday) {
        // weekday fill
        const key = WEEKDAY_KEYS[idx];
        const avail = employees.filter(
          (e) =>
            e.isActive && e.workDays.includes(key) && !onVacation.includes(e.id)
        );
        for (const emp of avail) {
          const times = pickEmployeeDefaultTimes(emp, idx);
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

  /** Update a single day (manually) */
  async updateDaySchedule(
    date: string,
    assignments: Assignment[]
  ): Promise<ScheduleDay> {
    const [y, m] = date.split("-").map(Number);
    const docId = getMonthlyScheduleId(y, m);
    const docRef = this.schedulesCollection.doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Schedule not found: ${docId}`);

    const monthly = snap.data() as MonthlySchedule;
    const idx = monthly.days.findIndex((d) => d.date === date);
    if (idx === -1) throw new Error(`Day ${date} not in schedule`);

    // validate no one on vacation
    for (const a of assignments) {
      const onVac = await vacationService.isEmployeeOnVacation(
        a.employeeId,
        date
      );
      if (onVac) throw new Error("Funcionário em férias neste dia");
    }

    monthly.days[idx].assignments = assignments;
    monthly.updatedAt = new Date().toISOString();
    await docRef.set(monthly);
    // clear this month from cache
    scheduleCache.delete(docId);
    return monthly.days[idx];
  }
}

export const scheduleService = new ScheduleService();
