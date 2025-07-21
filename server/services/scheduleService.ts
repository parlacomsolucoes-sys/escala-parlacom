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

/* -------------------------------------------------------------------------- */
/*                                    CACHE                                   */
/* -------------------------------------------------------------------------- */

const scheduleCache = new Map<
  string,
  { data: MonthlySchedule; etag: string; ts: number }
>();
const CACHE_TTL_MS = 60_000; // 1 min

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

/* -------------------------------------------------------------------------- */
/*                                MAIN SERVICE                                */
/* -------------------------------------------------------------------------- */

export class ScheduleService {
  private employeesCollection = adminDb.collection("employees");
  private holidaysCollection = adminDb.collection("holidays");
  private schedulesCollection = adminDb.collection("schedules");

  /** Limpa *todo* cache (todos os meses) */
  clearCache() {
    scheduleCache.clear();
  }

  /* ================================ EMPLOYEES ============================== */

  async getAllEmployees(): Promise<Employee[]> {
    const snapshot = await this.employeesCollection.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Employee, "id">),
    })) as Employee[];
  }

  async createEmployee(
    employee: Omit<Employee, "id" | "createdAt" | "updatedAt"> & {
      observations?: string;
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
      observations: employee.observations ?? "",
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(newEmployee);
    this.clearCache();
    return newEmployee;
  }

  async updateEmployee(
    id: string,
    employee: Partial<
      Omit<Employee, "id" | "createdAt" | "updatedAt"> & {
        observations?: string;
      }
    >
  ): Promise<Employee> {
    const docRef = this.employeesCollection.doc(id);
    const now = new Date().toISOString();

    const updateData: Partial<Omit<Employee, "id">> = {
      ...employee,
      updatedAt: now,
    };

    await docRef.update(updateData);
    const snap = await docRef.get();

    this.clearCache();
    return {
      id: snap.id,
      ...(snap.data() as Omit<Employee, "id">),
    } as Employee;
  }

  async deleteEmployee(id: string): Promise<void> {
    await this.employeesCollection.doc(id).delete();
    this.clearCache();
  }

  /* ================================ HOLIDAYS =============================== */

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
    /** date pode vir como YYYY‑MM‑DD ou MM‑DD */
    let mmdd = data.date;
    if (mmdd.length === 10 && mmdd.includes("-")) mmdd = mmdd.substring(5);
    const [mStr, dStr] = mmdd.split("-");
    const month = Number(mStr);
    const day = Number(dStr);

    const docRef = this.holidaysCollection.doc();
    const now = new Date().toISOString();

    const holiday: Holiday = {
      id: docRef.id,
      name: data.name,
      date: mmdd,
      description: data.description,
      month,
      day,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(holiday);
    this.clearCache();
    return holiday;
  }

  async deleteHoliday(id: string): Promise<void> {
    await this.holidaysCollection.doc(id).delete();
    this.clearCache();
  }

  /* ================================ SCHEDULE =============================== */

  /**
   * Busca (ou gera) a escala de um mês.
   * Se `forceRegenerate=true`, sempre recria.
   */
  async getScheduleForMonth(
    year: number,
    month: number,
    etag?: string,
    forceRegenerate = false
  ): Promise<{ schedule: ScheduleDay[]; etag: string; fromCache: boolean }> {
    const docId = getMonthlyScheduleId(year, month);

    /* ---------- cache ---------- */
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

    let monthly: MonthlySchedule;
    if (!snap.exists || forceRegenerate) {
      monthly = await this.createMonthlySchedule(year, month);
      await docRef.set(monthly);
    } else {
      monthly = snap.data() as MonthlySchedule;
    }

    const newEtag = generateETag(monthly);
    scheduleCache.set(docId, { data: monthly, etag: newEtag, ts: Date.now() });

    return { schedule: monthly.days, etag: newEtag, fromCache: false };
  }

  /**
   * Constrói uma nova escala mensal (inclui lógica de revezamento).
   */
  private async createMonthlySchedule(
    year: number,
    month: number
  ): Promise<MonthlySchedule> {
    /* ---------- dados base ---------- */
    const holidays = await this.getAllHolidays();
    const holidayMap = calcHolidayMap(holidays);
    const vacationMap = await vacationService.getEmployeesOnVacationForMonth(
      year,
      month
    );
    const employees = await this.getAllEmployees();
    const monthDays = getMonthDays(year, month);

    /* ---------- cria estrutura inicial de dias ---------- */
    const days: ScheduleDay[] = monthDays.map((date) => {
      const dateStr = formatDate(date);
      return {
        date: dateStr,
        assignments: [],
        isWeekend: isWeekend(date),
        isHoliday: isHolidayDate(date, holidayMap),
        ...(vacationMap.has(dateStr)
          ? { onVacationEmployeeIds: Array.from(vacationMap.get(dateStr)!) }
          : {}),
      };
    });

    /* ---------- revezamento de fins‑de‑semana ---------- */
    const weekendEmps = employees
      .filter((e) => e.isActive && e.weekendRotation)
      .sort((a, b) => a.name.localeCompare(b.name));

    // descobre quem ficou no último sábado do mês anterior
    const prevMonthId = getMonthlyScheduleId(
      month === 1 ? year - 1 : year,
      month === 1 ? 12 : month - 1
    );
    const prevSnap = await this.schedulesCollection.doc(prevMonthId).get();
    const prevLastSatId: string | null =
      prevSnap.exists && (prevSnap.data() as MonthlySchedule).rotationState
        ? (prevSnap.data() as MonthlySchedule).rotationState!
            .lastSaturdayEmployeeId
        : null;

    // ponteiro inicial
    let pointer = 0;
    if (prevLastSatId) {
      const idx = weekendEmps.findIndex((e) => e.id === prevLastSatId);
      if (idx !== -1) pointer = (idx + 1) % weekendEmps.length;
    }

    let lastSaturdayEmployeeId: string | null = prevLastSatId;

    for (const day of days) {
      if (!day.isWeekend || weekendEmps.length === 0) continue;

      const emp = weekendEmps[pointer];
      pointer = (pointer + 1) % weekendEmps.length;

      const onVac = day.onVacationEmployeeIds ?? [];
      if (!onVac.includes(emp.id)) {
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

      if (new Date(day.date).getDay() === 6) {
        lastSaturdayEmployeeId = emp.id;
      }
    }

    /* ---------- dias úteis ---------- */
    for (const day of days) {
      if (day.isWeekend || day.isHoliday) continue;

      const key = WEEKDAY_KEYS[new Date(day.date).getDay()];
      const avail = employees.filter(
        (e) =>
          e.isActive &&
          e.workDays.includes(key) &&
          !(day.onVacationEmployeeIds ?? []).includes(e.id)
      );

      for (const emp of avail) {
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

    const now = new Date().toISOString();
    return {
      year,
      month,
      days,
      rotationState: { lastSaturdayEmployeeId },
      generatedAt: now,
      updatedAt: now,
      version: 1,
    };
  }

  /**
   * Atualiza manualmente um dia específico da escala.
   */
  async updateDaySchedule(
    date: string,
    assignments: Assignment[]
  ): Promise<ScheduleDay> {
    const [yStr, mStr] = date.split("-");
    const year = Number(yStr);
    const month = Number(mStr);
    const docId = getMonthlyScheduleId(year, month);

    const docRef = this.schedulesCollection.doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Schedule not found for ${docId}`);

    const monthly = snap.data() as MonthlySchedule;
    const idx = monthly.days.findIndex((d) => d.date === date);
    if (idx === -1)
      throw new Error(`Day ${date} not found in schedule ${docId}`);

    // verifica férias
    for (const a of assignments) {
      if (await vacationService.isEmployeeOnVacation(a.employeeId, date)) {
        throw new Error("Funcionário em férias neste dia");
      }
    }

    monthly.days[idx].assignments = assignments;
    monthly.updatedAt = new Date().toISOString();

    await docRef.set(monthly);
    scheduleCache.delete(docId);
    return monthly.days[idx];
  }
}

export const scheduleService = new ScheduleService();
