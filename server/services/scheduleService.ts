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

// Desabilita cache para regenerar sempre após alterações
const scheduleCache = new Map<
  string,
  { data: MonthlySchedule; etag: string; ts: number }
>();
const CACHE_TTL_MS = 0;

export class ScheduleService {
  private employeesCollection = adminDb.collection("employees");
  private holidaysCollection = adminDb.collection("holidays");
  private schedulesCollection = adminDb.collection("schedules");

  async getAllEmployees(): Promise<Employee[]> {
    const snapshot = await this.employeesCollection.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Employee[];
  }

  async getAllHolidays(): Promise<Holiday[]> {
    const snapshot = await this.holidaysCollection.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Holiday[];
  }

  async getScheduleForMonth(
    year: number,
    month: number,
    etag?: string,
    forceRegenerate = false
  ): Promise<{ schedule: ScheduleDay[]; etag: string; fromCache: boolean }> {
    const docId = getMonthlyScheduleId(year, month);

    // sempre regenerar se TTL expirado
    const cached = scheduleCache.get(docId);
    if (!forceRegenerate && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      if (etag === cached.etag) throw new Error("NOT_MODIFIED");
      return { schedule: cached.data.days, etag: cached.etag, fromCache: true };
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

    const days: ScheduleDay[] = getMonthDays(year, month).map((date) => {
      const dateStr = formatDate(date);
      return {
        date: dateStr,
        assignments: [],
        isWeekend: isWeekend(date),
        isHoliday: isHolidayDate(date, holidayMap),
        ...(Array.from(vacationMap.get(dateStr) || []).length > 0
          ? { onVacationEmployeeIds: Array.from(vacationMap.get(dateStr)!) }
          : {}),
      };
    });

    // funcionários para revezamento
    const weekendEmps = employees
      .filter((e) => e.isActive && e.weekendRotation)
      .sort((a, b) => a.name.localeCompare(b.name));

    // buscar índice salvo no mês anterior
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevSnap = await this.schedulesCollection
      .doc(getMonthlyScheduleId(prevYear, prevMonth))
      .get()
      .catch(() => null);
    const prevSchedule = prevSnap?.exists
      ? (prevSnap.data() as MonthlySchedule)
      : null;
    let idx = prevSchedule?.rotationState?.lastWeekendIndex ?? 0;

    // atribuir escalas
    for (const day of days) {
      const dow = new Date(day.date).getDay();
      const onVac = day.onVacationEmployeeIds || [];
      // dias úteis
      if (!day.isWeekend && !day.isHoliday) {
        employees
          .filter(
            (e) =>
              e.isActive &&
              e.workDays.includes(
                [
                  "sunday",
                  "monday",
                  "tuesday",
                  "wednesday",
                  "thursday",
                  "friday",
                  "saturday",
                ][dow]
              ) &&
              !onVac.includes(e.id)
          )
          .forEach((emp) => {
            const t = pickEmployeeDefaultTimes(emp, dow);
            day.assignments.push({
              id: `${emp.id}-${day.date}`,
              employeeId: emp.id,
              employeeName: emp.name,
              startTime: normalizeTime(t.startTime),
              endTime: normalizeTime(t.endTime),
            });
          });
      }
      // finais de semana
      if (day.isWeekend && weekendEmps.length > 0) {
        let attempts = 0;
        while (attempts < weekendEmps.length) {
          const cand = weekendEmps[idx % weekendEmps.length];
          if (!onVac.includes(cand.id)) {
            const t = pickEmployeeDefaultTimes(cand, dow);
            day.assignments = day.assignments.filter(
              (a) => !weekendEmps.some((we) => we.id === a.employeeId)
            );
            day.assignments.push({
              id: `${cand.id}-${day.date}`,
              employeeId: cand.id,
              employeeName: cand.name,
              startTime: normalizeTime(t.startTime),
              endTime: normalizeTime(t.endTime),
            });
            idx++;
            break;
          }
          idx++;
          attempts++;
        }
      }
    }

    const now = new Date().toISOString();
    return {
      year,
      month,
      days,
      rotationState: { lastWeekendIndex: idx },
      generatedAt: now,
      updatedAt: now,
      version: 1,
    };
  }

  async updateDaySchedule(
    date: string,
    assignments: Assignment[]
  ): Promise<ScheduleDay> {
    const [y, m] = date.split("-").map(Number);
    const docId = getMonthlyScheduleId(y, m);
    const snap = await this.schedulesCollection.doc(docId).get();
    if (!snap.exists) throw new Error(`Schedule ${docId} not found`);
    const ms = snap.data() as MonthlySchedule;
    const dIndex = ms.days.findIndex((d) => d.date === date);
    if (dIndex < 0) throw new Error(`Day ${date} not in schedule`);
    // validações...
    ms.days[dIndex].assignments = assignments;
    ms.updatedAt = new Date().toISOString();
    await this.schedulesCollection.doc(docId).set(ms);
    scheduleCache.delete(docId);
    return ms.days[dIndex];
  }
}
export const scheduleService = new ScheduleService();
