// src/services/vacationService.ts

import { adminDb } from "../firebase-admin";
import type { Vacation, InsertVacation } from "@shared/schema";
import { scheduleService } from "./scheduleService";

export class VacationService {
  private vacationsCollection = adminDb.collection("vacations");

  /** Limpa cache de escalas para forçar rebuild com férias atualizadas */
  private clearSchedulesCache() {
    // clearCache é público em scheduleService
    scheduleService.clearCache();
  }

  /** Lista todos os períodos de férias de um ano, opcionalmente filtrando por funcionário */
  async list(year: number, employeeId?: string): Promise<Vacation[]> {
    const snapshot = await this.vacationsCollection.get();
    let all = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Vacation, "id">),
    })) as Vacation[];

    // filtra pelo ano
    all = all.filter((v) => v.year === year);

    // filtra por funcionário, se informado
    if (employeeId) {
      all = all.filter((v) => v.employeeId === employeeId);
    }

    // ordena por data de início
    all.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return all;
  }

  /** Cria um novo período de férias */
  async create(data: InsertVacation, employeeName: string): Promise<Vacation> {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (start > end) {
      throw new Error(
        "Data de início deve ser anterior ou igual à data de fim"
      );
    }
    if (start.getFullYear() !== end.getFullYear()) {
      throw new Error(
        "Período de férias não pode atravessar anos. Divida em dois registros."
      );
    }

    await this.checkOverlap(data.employeeId, data.startDate, data.endDate);

    const docRef = this.vacationsCollection.doc();
    const now = new Date().toISOString();
    const vacation: Vacation = {
      id: docRef.id,
      employeeId: data.employeeId,
      employeeName,
      year: start.getFullYear(),
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(vacation);
    this.clearSchedulesCache();
    return vacation;
  }

  /** Atualiza um período de férias existente */
  async update(id: string, data: Partial<InsertVacation>): Promise<Vacation> {
    const docRef = this.vacationsCollection.doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new Error("Período de férias não encontrado");
    }
    const existing = snap.data() as Vacation;

    // datas novas
    const newStart = data.startDate ?? existing.startDate;
    const newEnd = data.endDate ?? existing.endDate;
    const start = new Date(newStart);
    const end = new Date(newEnd);

    if (start > end) {
      throw new Error(
        "Data de início deve ser anterior ou igual à data de fim"
      );
    }
    if (start.getFullYear() !== end.getFullYear()) {
      throw new Error(
        "Período de férias não pode atravessar anos. Divida em dois registros."
      );
    }

    await this.checkOverlap(existing.employeeId, newStart, newEnd, id);

    const updatePayload: Partial<Vacation> = {
      ...data,
      year: start.getFullYear(),
      updatedAt: new Date().toISOString(),
    };

    await docRef.update(updatePayload);
    const updatedSnap = await docRef.get();
    const updated = updatedSnap.data() as Vacation;

    this.clearSchedulesCache();
    return { id, ...updated };
  }

  /** Remove um período de férias */
  async remove(id: string): Promise<void> {
    const docRef = this.vacationsCollection.doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new Error("Período de férias não encontrado");
    }
    await docRef.delete();
    this.clearSchedulesCache();
  }

  /** Verifica se funcionário está de férias em uma data específica */
  async isEmployeeOnVacation(
    employeeId: string,
    dateString: string
  ): Promise<boolean> {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const snapshot = await this.vacationsCollection.get();

    for (const doc of snapshot.docs) {
      const vac = doc.data() as Vacation;
      if (vac.employeeId !== employeeId || vac.year !== year) {
        continue;
      }
      const start = new Date(vac.startDate);
      const end = new Date(vac.endDate);
      if (date >= start && date <= end) {
        return true;
      }
    }
    return false;
  }

  /** Mapeia cada dia do mês para o conjunto de funcionários de férias naquele dia */
  async getEmployeesOnVacationForMonth(
    year: number,
    month: number
  ): Promise<Map<string, Set<string>>> {
    const snapshot = await this.vacationsCollection.get();
    const vacationsByDate = new Map<string, Set<string>>();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    for (const doc of snapshot.docs) {
      const vac = doc.data() as Vacation;
      if (vac.year !== year) continue;

      const vacStart = new Date(vac.startDate);
      const vacEnd = new Date(vac.endDate);

      if (vacEnd >= monthStart && vacStart <= monthEnd) {
        const start = vacStart < monthStart ? monthStart : vacStart;
        const end = vacEnd > monthEnd ? monthEnd : vacEnd;
        const iter = new Date(start);

        while (iter <= end) {
          const key = iter.toISOString().split("T")[0];
          if (!vacationsByDate.has(key)) {
            vacationsByDate.set(key, new Set());
          }
          vacationsByDate.get(key)!.add(vac.employeeId);
          iter.setDate(iter.getDate() + 1);
        }
      }
    }

    return vacationsByDate;
  }

  /** Garante que não há sobreposição de férias para o mesmo funcionário */
  private async checkOverlap(
    employeeId: string,
    startDate: string,
    endDate: string,
    excludeId?: string
  ): Promise<void> {
    const year = new Date(startDate).getFullYear();
    const snapshot = await this.vacationsCollection.get();
    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    for (const doc of snapshot.docs) {
      if (doc.id === excludeId) continue;
      const vac = doc.data() as Vacation;
      if (vac.employeeId !== employeeId || vac.year !== year) {
        continue;
      }
      const existStart = new Date(vac.startDate);
      const existEnd = new Date(vac.endDate);
      if (newStart <= existEnd && newEnd >= existStart) {
        throw new Error(
          "Período de férias conflita com outro período existente para este funcionário"
        );
      }
    }
  }
}

export const vacationService = new VacationService();
