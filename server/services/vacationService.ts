import { adminDb } from "../firebase-admin";
import type { Vacation, InsertVacation } from "@shared/schema";
import { scheduleService } from "./scheduleService";
import { getMonthlyScheduleId } from "@shared/utils/schedule";

export class VacationService {
  private vacationsCollection = adminDb.collection("vacations");

  /**
   * Lista períodos de férias de um ano, opcionalmente filtrando por funcionário
   */
  async list(year: number, employeeId?: string): Promise<Vacation[]> {
    const snapshot = await this.vacationsCollection.get();
    let results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Vacation[];
    results = results.filter((v) => v.year === year);
    if (employeeId) {
      results = results.filter((v) => v.employeeId === employeeId);
    }
    results.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return results;
  }

  /**
   * Cria um novo período de férias e regenera a escala para o(s) mês(es) afetado(s)
   */
  async create(data: InsertVacation, employeeName: string): Promise<Vacation> {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (start > end)
      throw new Error(
        "Data de início deve ser anterior ou igual à data de fim"
      );
    if (start.getFullYear() !== end.getFullYear())
      throw new Error(
        "Período de férias não pode atravessar anos. Divida em dois registros."
      );
    await this.checkOverlap(data.employeeId, data.startDate, data.endDate);

    const docRef = this.vacationsCollection.doc();
    const vacation: Vacation = {
      id: docRef.id,
      employeeId: data.employeeId,
      employeeName,
      year: start.getFullYear(),
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await docRef.set(vacation);

    // Regenera escala para os meses afetados
    const startMonth = start.getMonth() + 1;
    const endMonth = end.getMonth() + 1;
    for (let m = startMonth; m <= endMonth; m++) {
      await scheduleService.getScheduleForMonth(
        start.getFullYear(),
        m,
        undefined,
        true
      );
    }

    return vacation;
  }

  /**
   * Atualiza um período de férias e regenera a escala para o(s) mês(es) afetado(s)
   */
  async update(id: string, data: Partial<InsertVacation>): Promise<Vacation> {
    const docRef = this.vacationsCollection.doc(id);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error("Período de férias não encontrado");
    const existing = snap.data() as Vacation;

    const newStart = data.startDate
      ? new Date(data.startDate)
      : new Date(existing.startDate);
    const newEnd = data.endDate
      ? new Date(data.endDate)
      : new Date(existing.endDate);
    if (newStart > newEnd)
      throw new Error(
        "Data de início deve ser anterior ou igual à data de fim"
      );
    if (newStart.getFullYear() !== newEnd.getFullYear())
      throw new Error(
        "Período de férias não pode atravessar anos. Divida em dois registros."
      );
    await this.checkOverlap(
      existing.employeeId,
      newStart.toISOString().split("T")[0],
      newEnd.toISOString().split("T")[0],
      id
    );

    const updateData: Partial<Vacation> = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await docRef.update(updateData);
    const updated = (await docRef.get()).data() as Vacation;

    // Regenera escala para meses antigos e novos
    const oldStart = new Date(existing.startDate);
    const oldEnd = new Date(existing.endDate);
    const months = new Set<number>();
    for (let m = oldStart.getMonth() + 1; m <= oldEnd.getMonth() + 1; m++)
      months.add(m);
    for (let m = newStart.getMonth() + 1; m <= newEnd.getMonth() + 1; m++)
      months.add(m);
    months.forEach(async (m) => {
      await scheduleService.getScheduleForMonth(
        newStart.getFullYear(),
        m,
        undefined,
        true
      );
    });

    return { id, ...updated } as Vacation;
  }

  /**
   * Remove um período de férias e regenera a escala para o(s) mês(es) afetado(s)
   */
  async remove(id: string): Promise<void> {
    const docRef = this.vacationsCollection.doc(id);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error("Período de férias não encontrado");
    const existing = snap.data() as Vacation;
    await docRef.delete();

    // Regenera escala para meses afetados
    const start = new Date(existing.startDate);
    const end = new Date(existing.endDate);
    for (let m = start.getMonth() + 1; m <= end.getMonth() + 1; m++) {
      await scheduleService.getScheduleForMonth(
        existing.year,
        m,
        undefined,
        true
      );
    }
  }

  /**
   * Verifica se funcionário está em férias em uma data específica
   */
  async isEmployeeOnVacation(
    employeeId: string,
    dateString: string
  ): Promise<boolean> {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const list = await this.list(year, employeeId);
    return list.some(
      (v) => date >= new Date(v.startDate) && date <= new Date(v.endDate)
    );
  }

  /**
   * Retorna mapa de { 'YYYY-MM-DD' => Set<employeeId> } para um mês
   */
  async getEmployeesOnVacationForMonth(
    year: number,
    month: number
  ): Promise<Map<string, Set<string>>> {
    const snapshot = await this.vacationsCollection.get();
    const map = new Map<string, Set<string>>();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    snapshot.docs.forEach((doc) => {
      const v = doc.data() as Vacation;
      if (v.year !== year) return;
      const vs = new Date(v.startDate);
      const ve = new Date(v.endDate);
      if (ve < monthStart || vs > monthEnd) return;
      const start = new Date(Math.max(vs.getTime(), monthStart.getTime()));
      const end = new Date(Math.min(ve.getTime(), monthEnd.getTime()));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split("T")[0];
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(v.employeeId);
      }
    });

    return map;
  }

  /**
   * Check overlap excluding um ID opcional
   */
  private async checkOverlap(
    employeeId: string,
    startDate: string,
    endDate: string,
    excludeId?: string
  ): Promise<void> {
    const year = new Date(startDate).getFullYear();
    const list = await this.list(year, employeeId);
    const ns = new Date(startDate);
    const ne = new Date(endDate);
    list.forEach((v) => {
      if (v.id === excludeId) return;
      const es = new Date(v.startDate);
      const ee = new Date(v.endDate);
      if (ns <= ee && ne >= es) {
        throw new Error(
          "Período de férias conflita com outro período existente para este funcionário"
        );
      }
    });
  }
}

export const vacationService = new VacationService();
