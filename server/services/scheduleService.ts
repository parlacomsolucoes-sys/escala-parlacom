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
  isWeekend as utilIsWeekend,
  isHolidayDate,
  pickEmployeeDefaultTimes,
  getMonthlyScheduleId,
  generateETag,
} from "@shared/utils/schedule";
import { normalizeTime } from "@shared/schema";
import { vacationService } from "./vacationService";

/**
 * Cache em memória (reiniciado a cada cold start).
 */
const scheduleCache = new Map<
  string,
  { data: MonthlySchedule; etag: string; ts: number }
>();
const CACHE_TTL_MS = 60_000; // 60s

export class ScheduleService {
  private employeesCollection = adminDb.collection("employees");
  private holidaysCollection = adminDb.collection("holidays");
  private schedulesCollection = adminDb.collection("schedules");

  /* =====================================================
   * EMPLOYEES
   * ===================================================*/
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
    await docRef.update({ ...employee, updatedAt: new Date().toISOString() });
    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as Employee;
  }

  async deleteEmployee(id: string): Promise<void> {
    await this.employeesCollection.doc(id).delete();
  }

  /* =====================================================
   * HOLIDAYS
   * ===================================================*/
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
    // Normaliza para MM-DD se vier YYYY-MM-DD
    let mmddDate = data.date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      mmddDate = data.date.substring(5);
    }
    const [monthStr, dayStr] = mmddDate.split("-");
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    const docRef = this.holidaysCollection.doc();
    const now = new Date().toISOString();
    const holiday: Holiday = {
      id: docRef.id,
      name: data.name,
      date: mmddDate,
      month,
      day,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    };
    await docRef.set(holiday);
    return holiday;
  }

  async deleteHoliday(id: string): Promise<void> {
    await this.holidaysCollection.doc(id).delete();
  }

  /* =====================================================
   * CORE SCHEDULE ACCESS (GET)
   * ===================================================*/
  async getScheduleForMonth(
    year: number,
    month: number,
    etag?: string,
    forceRegenerate = false
  ): Promise<{ schedule: ScheduleDay[]; etag: string; fromCache: boolean }> {
    const docId = getMonthlyScheduleId(year, month);

    // Cache
    if (!forceRegenerate) {
      const cached = scheduleCache.get(docId);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        if (etag && etag === cached.etag) {
          // 304 controlado externamente
          throw new Error("NOT_MODIFIED");
        }
        return {
          schedule: cached.data.days,
          etag: cached.etag,
          fromCache: true,
        };
      }
    }

    // Firestore
    const docRef = this.schedulesCollection.doc(docId);
    const snap = await docRef.get();
    let monthly: MonthlySchedule;

    if (!snap.exists || forceRegenerate) {
      monthly = await this.generateMonthlySchedule(year, month);
      await docRef.set(monthly);
    } else {
      monthly = snap.data() as MonthlySchedule;
    }

    const newEtag = generateETag(monthly);
    scheduleCache.set(docId, {
      data: monthly,
      etag: newEtag,
      ts: Date.now(),
    });

    return { schedule: monthly.days, etag: newEtag, fromCache: false };
  }

  /* =====================================================
   * GENERATION HELPERS
   * ===================================================*/
  private weekdayKeyMap = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const;

  private getWeekdayKey(date: Date): string {
    return this.weekdayKeyMap[date.getDay()];
  }

  /**
   * Cria o esqueleto mensal (sem assignments).
   */
  private async createEmptyMonthly(
    year: number,
    month: number
  ): Promise<MonthlySchedule> {
    const holidays = await this.getAllHolidays();
    const holidayMap = calcHolidayMap(holidays);
    const vacationMap = await vacationService.getEmployeesOnVacationForMonth(
      year,
      month
    );
    const monthDays = getMonthDays(year, month);

    const days: ScheduleDay[] = monthDays.map((d) => {
      const dateStr = formatDate(d);
      const wknd = utilIsWeekend(d);
      const holiday = isHolidayDate(d, holidayMap);
      const onVacationEmployeeIds = Array.from(vacationMap.get(dateStr) || []);
      return {
        date: dateStr,
        assignments: [],
        isWeekend: wknd,
        isHoliday: holiday,
        onVacationEmployeeIds:
          onVacationEmployeeIds.length > 0 ? onVacationEmployeeIds : undefined,
      };
    });

    const now = new Date().toISOString();
    return {
      year,
      month,
      days,
      rotationState: { lastWeekendIndex: 0 },
      generatedAt: now,
      updatedAt: now,
      version: 1,
    };
  }

  /**
   * Geração completa (dias úteis + mantém estrutura).
   * Recalcula sempre (chamada com forceRegenerate).
   */
  async generateMonthlySchedule(
    year: number,
    month: number
  ): Promise<MonthlySchedule> {
    const monthly = await this.createEmptyMonthly(year, month);
    const employees = (await this.getAllEmployees()).filter((e) => e.isActive);

    if (employees.length === 0) {
      return monthly;
    }

    // Index de férias para performance (já veio no monthly.onVacationEmployeeIds)
    for (const day of monthly.days) {
      if (day.isHoliday) continue; // pula feriado
      if (day.isWeekend) continue; // finais de semana tratados separadamente (rota weekend)
      // Monta assignments para cada funcionário que trabalha naquele dia
      for (const emp of employees) {
        const weekdayKey = this.getWeekdayKey(new Date(day.date));
        const worksToday = emp.workDays?.includes(weekdayKey);
        if (!worksToday) continue;

        // Férias?
        const onVac = day.onVacationEmployeeIds?.includes(emp.id);
        if (onVac) continue;

        // Horário customizado?
        let startTime = emp.defaultStartTime;
        let endTime = emp.defaultEndTime;
        if (emp.customSchedule && emp.customSchedule[weekdayKey]) {
          startTime = emp.customSchedule[weekdayKey].startTime;
          endTime = emp.customSchedule[weekdayKey].endTime;
        }

        day.assignments.push({
          id: `${emp.id}-${day.date}`,
          employeeId: emp.id,
          employeeName: emp.name,
          startTime: normalizeTime(startTime),
          endTime: normalizeTime(endTime),
        });
      }
    }

    monthly.updatedAt = new Date().toISOString();
    return monthly;
  }

  /**
   * Gera somente finais de semana com rotação (não mexe nos dias úteis).
   * Supõe que o documento já existe (se não existir cria vazio).
   */
  async generateWeekendSchedule(
    year: number,
    month: number
  ): Promise<{
    message: string;
    daysUpdated: number;
    rotationState: { lastWeekendIndex: number };
  }> {
    const docId = getMonthlyScheduleId(year, month);
    const docRef = this.schedulesCollection.doc(docId);
    const snap = await docRef.get();

    let monthly: MonthlySchedule;
    if (!snap.exists) {
      // cria vazio primeiro
      monthly = await this.createEmptyMonthly(year, month);
    } else {
      monthly = snap.data() as MonthlySchedule;
    }

    const employees = (await this.getAllEmployees())
      .filter((e) => e.isActive && e.weekendRotation)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (employees.length === 0) {
      await docRef.set(monthly);
      scheduleCache.delete(docId);
      return {
        message: "Nenhum funcionário elegível para escala de finais de semana",
        daysUpdated: 0,
        rotationState: monthly.rotationState || { lastWeekendIndex: 0 },
      };
    }

    let idx = monthly.rotationState?.lastWeekendIndex || 0;
    let updated = 0;

    for (const day of monthly.days) {
      if (!day.isWeekend) continue;
      if (day.isHoliday) continue;

      // Selecionar próximo disponível (não em férias)
      let attempts = 0;
      let chosen: Employee | null = null;
      while (attempts < employees.length) {
        const candidate = employees[idx % employees.length];
        const onVac = day.onVacationEmployeeIds?.includes(candidate.id);
        if (!onVac) {
          chosen = candidate;
          break;
        }
        idx++;
        attempts++;
      }
      if (!chosen) continue;

      const weekdayIndex = new Date(day.date).getDay();
      const times = pickEmployeeDefaultTimes(chosen, weekdayIndex);

      // Remove assignments anteriores de alguém que participe da rotação
      day.assignments = day.assignments.filter(
        (a) => !employees.some((we) => we.id === a.employeeId)
      );

      day.assignments.push({
        id: `${chosen.id}-${day.date}`,
        employeeId: chosen.id,
        employeeName: chosen.name,
        startTime: normalizeTime(times.startTime),
        endTime: normalizeTime(times.endTime),
      });

      idx++;
      updated++;
    }

    monthly.rotationState = { lastWeekendIndex: idx };
    monthly.updatedAt = new Date().toISOString();
    await docRef.set(monthly);
    scheduleCache.delete(docId);

    return {
      message: `Atualizados ${updated} dias de fim de semana`,
      daysUpdated: updated,
      rotationState: monthly.rotationState,
    };
  }

  /**
   * Atualiza manualmente um dia (substitui assignments).
   */
  async updateDaySchedule(
    date: string,
    assignments: Assignment[]
  ): Promise<ScheduleDay> {
    const [y, m] = date.split("-").map(Number);
    const docId = getMonthlyScheduleId(y, m);
    const docRef = this.schedulesCollection.doc(docId);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new Error(`Schedule não encontrado para ${docId}`);
    }
    const monthly = snap.data() as MonthlySchedule;
    const dayIdx = monthly.days.findIndex((d) => d.date === date);
    if (dayIdx === -1) {
      throw new Error(`Dia ${date} não existe na escala`);
    }

    // Valida férias + formato
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const a of assignments) {
      if (
        !a.employeeId ||
        !a.employeeName ||
        !a.startTime ||
        !a.endTime ||
        !timeRegex.test(a.startTime) ||
        !timeRegex.test(a.endTime)
      ) {
        throw new Error("Assignment inválido (campos ou formato de hora)");
      }
      const onVacation = await vacationService.isEmployeeOnVacation(
        a.employeeId,
        date
      );
      if (onVacation) {
        throw new Error(`Funcionário em férias neste dia: ${a.employeeName}`);
      }
    }

    monthly.days[dayIdx].assignments = assignments;
    monthly.updatedAt = new Date().toISOString();
    await docRef.set(monthly);
    scheduleCache.delete(docId);
    return monthly.days[dayIdx];
  }
}

export const scheduleService = new ScheduleService();
