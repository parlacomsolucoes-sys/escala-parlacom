import { adminDb } from "../firebase-admin";
import type { Vacation, InsertVacation } from "@shared/schema";
import { scheduleService } from "./scheduleService";

export class VacationService {
  private vacationsCollection = adminDb.collection("vacations");

  /** Clear all cached schedules so they’ll rebuild with fresh data */
  private clearSchedulesCache() {
    // The clearCache method on scheduleService is private, so we cast to any
    (scheduleService as any).clearCache();
  }

  /** List vacations for a given year, optionally filtered by employee */
  async list(year: number, employeeId?: string): Promise<Vacation[]> {
    const snapshot = await this.vacationsCollection.get();
    let all = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Vacation[];

    // Filter by year
    all = all.filter((v) => v.year === year);

    // Filter by employee if requested
    if (employeeId) {
      all = all.filter((v) => v.employeeId === employeeId);
    }

    // Sort by start date
    all.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return all;
  }

  /** Create a new vacation period */
  async create(data: InsertVacation, employeeName: string): Promise<Vacation> {
    // Validate date order
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (start > end) {
      throw new Error(
        "Data de início deve ser anterior ou igual à data de fim"
      );
    }

    // Ensure same year
    if (start.getFullYear() !== end.getFullYear()) {
      throw new Error(
        "Período de férias não pode atravessar anos. Divida em dois registros."
      );
    }

    // Check for overlaps
    await this.checkOverlap(data.employeeId, data.startDate, data.endDate);

    // Build the vacation record
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

    // Persist
    await docRef.set(vacation);

    // Clear schedule cache so next fetch rebuilds around this new vacation
    this.clearSchedulesCache();

    return vacation;
  }

  /** Update an existing vacation period */
  async update(id: string, data: Partial<InsertVacation>): Promise<Vacation> {
    const docRef = this.vacationsCollection.doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      throw new Error("Período de férias não encontrado");
    }

    const existing = docSnap.data() as Vacation;

    // If dates are changing, re-validate
    const newStart = data.startDate ?? existing.startDate;
    const newEnd = data.endDate ?? existing.endDate;
    const startDate = new Date(newStart);
    const endDate = new Date(newEnd);

    if (startDate > endDate) {
      throw new Error(
        "Data de início deve ser anterior ou igual à data de fim"
      );
    }
    if (startDate.getFullYear() !== endDate.getFullYear()) {
      throw new Error(
        "Período de férias não pode atravessar anos. Divida em dois registros."
      );
    }

    // Check overlap excluding this record
    await this.checkOverlap(existing.employeeId, newStart, newEnd, id);

    // Prepare update payload
    const updatePayload: Partial<Vacation> = {
      ...data,
      year: startDate.getFullYear(),
      updatedAt: new Date().toISOString(),
    };

    // Apply update
    await docRef.update(updatePayload);

    const updatedSnap = await docRef.get();
    const updated = updatedSnap.data() as Vacation;

    // Clear schedule cache due to changed vacation
    this.clearSchedulesCache();

    return { id, ...updated };
  }

  /** Remove a vacation period */
  async remove(id: string): Promise<void> {
    const docRef = this.vacationsCollection.doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      throw new Error("Período de férias não encontrado");
    }

    await docRef.delete();

    // Clear schedule cache
    this.clearSchedulesCache();
  }

  /** Check if an employee is on vacation on a specific date */
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

  /** Build a map of dates to sets of employeeIds on vacation in that month */
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

      // If the vacation overlaps this month
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

  /** Ensure no overlapping vacations for the same employee */
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
      if (vac.employeeId !== employeeId || vac.year !== year) continue;

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
