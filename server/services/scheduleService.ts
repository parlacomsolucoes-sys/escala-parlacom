// server/services/scheduleService.ts
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

// Cache em memória
const scheduleCache = new Map<
  string,
  { data: MonthlySchedule; etag: string; ts: number }
>();
const CACHE_TTL_MS = 60_000;

export class ScheduleService {
  private employeesCollection = adminDb.collection("employees");
  private holidaysCollection = adminDb.collection("holidays");
  private schedulesCollection = adminDb.collection("schedules");

  /* ================= EMPLOYEES ================= */
  async getAllEmployees(): Promise<Employee[]> {
    const snap = await this.employeesCollection.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Employee[];
  }

  async createEmployee(
    employee: Omit<Employee, "id" | "createdAt" | "updatedAt">
  ): Promise<Employee> {
    const ref = this.employeesCollection.doc();
    const now = new Date().toISOString();
    const newEmployee: Employee = {
      id: ref.id,
      ...employee,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(newEmployee);
    return newEmployee;
  }

  async updateEmployee(
    id: string,
    partial: Partial<Omit<Employee, "id" | "createdAt">>
  ): Promise<Employee> {
    const ref = this.employeesCollection.doc(id);
    await ref.update({ ...partial, updatedAt: new Date().toISOString() });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as Employee;
  }

  async deleteEmployee(id: string): Promise<void> {
    await this.employeesCollection.doc(id).delete();
  }

  /* ================= HOLIDAYS ================= */
  async getAllHolidays(): Promise<Holiday[]> {
    const snap = await this.holidaysCollection.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Holiday[];
  }

  async createHoliday(data: {
    name: string;
    date: string;
    description?: string;
  }): Promise<Holiday> {
    let mmdd = data.date;
    if (mmdd.length === 10 && mmdd.includes("-")) {
      mmdd = mmdd.substring(5);
    }
    const [mStr, dStr] = mmdd.split("-");
    const month = parseInt(mStr, 10);
    const day = parseInt(dStr, 10);
    const ref = this.holidaysCollection.doc();
    const now = new Date().toISOString();
    const holiday: Holiday = {
      id: ref.id,
      name: data.name,
      date: mmdd,
      description: data.description,
      month,
      day,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(holiday);
    return holiday;
  }

  async deleteHoliday(id: string): Promise<void> {
    await this.holidaysCollection.doc(id).delete();
  }

  /* ================= SCHEDULE (PUBLIC METHODS) ================= */

  /**
   * Retorna (ou gera) a escala mensal sem recriar assignments.
   * Se forceRegenerate=true, recria o documento mês (limpo) sem assignments (usado como base).
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

    const ref = this.schedulesCollection.doc(docId);
    const snap = await ref.get();
    let monthly: MonthlySchedule;

    if (!snap.exists || forceRegenerate) {
      monthly = await this.createMonthlySkeleton(year, month);
      await ref.set(monthly);
    } else {
      monthly = snap.data() as MonthlySchedule;
    }

    const newEtag = generateETag(monthly);
    scheduleCache.set(docId, { data: monthly, etag: newEtag, ts: Date.now() });
    return { schedule: monthly.days, etag: newEtag, fromCache: false };
  }

  /**
   * Gera (ou regenera) a escala mensal **com assignments** para dias úteis
   * e mantém/gera rotação de fins de semana se desejar (pode chamar depois generateWeekendSchedule).
   */
  async generateMonthlySchedule(
    year: number,
    month: number
  ): Promise<ScheduleDay[]> {
    const docId = getMonthlyScheduleId(year, month);
    const ref = this.schedulesCollection.doc(docId);

    // Carregar lista base (sem assignments) – cria se não existir.
    const { schedule: baseDays } = await this.getScheduleForMonth(
      year,
      month,
      undefined,
      true
    );

    const employees = (await this.getAllEmployees())
      .filter((e) => e.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));

    const holidays = await this.getAllHolidays();
    const holidayMap = calcHolidayMap(holidays);
    const vacationMap = await vacationService.getEmployeesOnVacationForMonth(
      year,
      month
    );

    if (employees.length === 0) {
      console.warn("[generateMonthlySchedule] Nenhum funcionário ativo.");
    }

    // Round-robin pointer por dia útil
    let pointer = 0;

    const populated: ScheduleDay[] = baseDays.map((day) => {
      // Já tem assignments? (porque talvez você queira preservar algo – aqui vamos sobrescrever para geração)
      const dateObj = new Date(day.date);
      const weekend = day.isWeekend;
      const holiday = day.isHoliday;
      const onVacationIds = Array.from(vacationMap.get(day.date) || []);

      // Não gerar assignments se feriado ou fim de semana (fim de semana será tratado separadamente)
      if (holiday || weekend) {
        return {
          ...day,
          assignments: [],
          onVacationEmployeeIds: onVacationIds.length
            ? onVacationIds
            : undefined,
        };
      }

      // Selecionar funcionários que trabalham nesse dia da semana
      const weekdayIdx = dateObj.getDay(); // 0=Dom
      const weekdayName = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ][weekdayIdx] as (typeof employees)[number]["workDays"][number];

      const availableToday = employees.filter(
        (e) => e.workDays.includes(weekdayName) && !onVacationIds.includes(e.id)
      );

      const assignments: Assignment[] = [];

      // Estratégia simples: todos os disponíveis entram com seu horário default
      for (const emp of availableToday) {
        const times = pickEmployeeDefaultTimes(emp, weekdayIdx);
        assignments.push({
          id: `${emp.id}-${day.date}`,
          employeeId: emp.id,
          employeeName: emp.name,
          startTime: normalizeTime(times.startTime),
          endTime: normalizeTime(times.endTime),
        });
      }

      // Exemplo alternativo (caso quisesse apenas 1 por dia):
      // if (availableToday.length > 0) {
      //   const emp = availableToday[pointer % availableToday.length];
      //   pointer++;
      //   const times = pickEmployeeDefaultTimes(emp, weekdayIdx);
      //   assignments.push({
      //     id: `${emp.id}-${day.date}`,
      //     employeeId: emp.id,
      //     employeeName: emp.name,
      //     startTime: normalizeTime(times.startTime),
      //     endTime: normalizeTime(times.endTime)
      //   });
      // }

      return {
        ...day,
        assignments,
        onVacationEmployeeIds: onVacationIds.length ? onVacationIds : undefined,
      };
    });

    const monthly: MonthlySchedule = {
      year,
      month,
      days: populated,
      rotationState: { lastWeekendIndex: 0 },
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    await ref.set(monthly);
    scheduleCache.delete(docId);

    console.log(
      `[generateMonthlySchedule] Dias úteis com assignments: ${
        monthly.days.filter(
          (d) => !d.isWeekend && !d.isHoliday && d.assignments.length > 0
        ).length
      }`
    );

    return monthly.days;
  }

  /**
   * Gera/atualiza apenas fins de semana (rotação).
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
    const ref = this.schedulesCollection.doc(docId);
    const snap = await ref.get();

    if (!snap.exists) {
      // Garante base antes
      await this.getScheduleForMonth(year, month, undefined, true);
    }

    const doc2 = await ref.get();
    let monthly = doc2.data() as MonthlySchedule;

    const employees = (await this.getAllEmployees())
      .filter((e) => e.weekendRotation && e.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (employees.length === 0) {
      return {
        message: "Nenhum funcionário elegível para rotação de fim de semana",
        daysUpdated: 0,
        rotationState: { lastWeekendIndex: 0 },
      };
    }

    let currentIndex = monthly.rotationState?.lastWeekendIndex || 0;
    let daysUpdated = 0;

    for (const day of monthly.days) {
      if (day.isWeekend && !day.isHoliday) {
        // evitar férias
        const vacationIds = day.onVacationEmployeeIds || [];
        let attempts = 0;
        let chosen: Employee | null = null;
        while (attempts < employees.length) {
          const candidate = employees[currentIndex % employees.length];
          if (!vacationIds.includes(candidate.id)) {
            chosen = candidate;
            break;
          }
          currentIndex++;
          attempts++;
        }
        if (chosen) {
          // remover qualquer assignment antigo de rotação
          day.assignments = day.assignments.filter(
            (a) => !employees.some((we) => we.id === a.employeeId)
          );
          const weekday = new Date(day.date).getDay();
          const times = pickEmployeeDefaultTimes(chosen, weekday);
          day.assignments.push({
            id: `${chosen.id}-${day.date}`,
            employeeId: chosen.id,
            employeeName: chosen.name,
            startTime: normalizeTime(times.startTime),
            endTime: normalizeTime(times.endTime),
          });
          currentIndex++;
          daysUpdated++;
        }
      }
    }

    monthly.rotationState = { lastWeekendIndex: currentIndex };
    monthly.updatedAt = new Date().toISOString();
    await ref.set(monthly);
    scheduleCache.delete(docId);

    return {
      message: `Atualizados ${daysUpdated} dias de fim de semana`,
      daysUpdated,
      rotationState: monthly.rotationState,
    };
  }

  /**
   * Atualiza assignments de um dia manualmente.
   */
  async updateDaySchedule(
    date: string,
    assignments: Assignment[]
  ): Promise<ScheduleDay> {
    const [year, month] = date.split("-").map(Number);
    const docId = getMonthlyScheduleId(year, month);
    const ref = this.schedulesCollection.doc(docId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Schedule not found for ${docId}`);

    const monthly = snap.data() as MonthlySchedule;
    const idx = monthly.days.findIndex((d) => d.date === date);
    if (idx === -1) throw new Error(`Day ${date} not found`);

    // (validações simples)
    for (const a of assignments) {
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.endTime)
      ) {
        throw new Error("Formato de hora inválido");
      }
    }

    monthly.days[idx].assignments = assignments;
    monthly.updatedAt = new Date().toISOString();
    await ref.set(monthly);
    scheduleCache.delete(docId);
    return monthly.days[idx];
  }

  /* ================= PRIVADOS ================= */

  private async createMonthlySkeleton(
    year: number,
    month: number
  ): Promise<MonthlySchedule> {
    const holidays = await this.getAllHolidays();
    const holidayMap = calcHolidayMap(holidays);
    const vacationMap = await vacationService.getEmployeesOnVacationForMonth(
      year,
      month
    );
    const dates = getMonthDays(year, month);

    const days: ScheduleDay[] = dates.map((date) => {
      const iso = formatDate(date);
      const weekend = isWeekend(date);
      const holiday = isHolidayDate(date, holidayMap);
      const vacIds = Array.from(vacationMap.get(iso) || []);
      return {
        date: iso,
        assignments: [],
        isWeekend: weekend,
        isHoliday: holiday,
        onVacationEmployeeIds: vacIds.length ? vacIds : undefined,
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
}

export const scheduleService = new ScheduleService();
