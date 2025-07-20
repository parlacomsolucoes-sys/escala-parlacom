import { adminDb } from "../firebase-admin";
import type { Vacation, InsertVacation } from "@shared/schema";

export class VacationService {
  private vacationsCollection = adminDb.collection("vacations");

  async list(year: number, employeeId?: string): Promise<Vacation[]> {
    const snap = await this.vacationsCollection.get();
    let results = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Vacation[];
    results = results.filter((v) => v.year === year);
    if (employeeId)
      results = results.filter((v) => v.employeeId === employeeId);
    results.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return results;
  }

  async create(data: InsertVacation, employeeName: string): Promise<Vacation> {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (start > end) throw new Error("Data de início deve ser <= data de fim");
    if (start.getFullYear() !== end.getFullYear())
      throw new Error("Não pode atravessar anos");
    await this.checkOverlap(data.employeeId, data.startDate, data.endDate);
    const docRef = this.vacationsCollection.doc();
    const vacation: Vacation = {
      id: docRef.id,
      employeeName,
      year: start.getFullYear(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await docRef.set(vacation);
    return vacation;
  }

  async update(id: string, data: Partial<InsertVacation>): Promise<Vacation> {
    const ref = this.vacationsCollection.doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new Error("Férias não encontrado");
    const existing = doc.data() as Vacation;
    const newStart = data.startDate ?? existing.startDate;
    const newEnd = data.endDate ?? existing.endDate;
    const s = new Date(newStart),
      e = new Date(newEnd);
    if (s > e) throw new Error("Data de início deve ser <= data de fim");
    if (s.getFullYear() !== e.getFullYear())
      throw new Error("Não pode atravessar anos");
    await this.checkOverlap(existing.employeeId, newStart, newEnd, id);
    const updateData = {
      ...data,
      year: s.getFullYear(),
      updatedAt: new Date().toISOString(),
    };
    await ref.update(updateData);
    const updated = await ref.get();
    return { id: updated.id, ...(updated.data() as Vacation) };
  }

  async remove(id: string): Promise<void> {
    const ref = this.vacationsCollection.doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new Error("Férias não encontrado");
    await ref.delete();
  }

  async isEmployeeOnVacation(
    employeeId: string,
    dateString: string
  ): Promise<boolean> {
    const d = new Date(dateString);
    const year = d.getFullYear();
    const snap = await this.vacationsCollection.get();
    for (const doc of snap.docs) {
      const v = doc.data() as Vacation;
      if (v.year !== year || v.employeeId !== employeeId) continue;
      const start = new Date(v.startDate),
        end = new Date(v.endDate);
      if (d >= start && d <= end) return true;
    }
    return false;
  }

  async getEmployeesOnVacationForMonth(
    year: number,
    month: number
  ): Promise<Map<string, Set<string>>> {
    const snap = await this.vacationsCollection.get();
    const m = new Map<string, Set<string>>();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    for (const doc of snap.docs) {
      const v = doc.data() as Vacation;
      if (v.year !== year) continue;
      const s = new Date(v.startDate),
        e = new Date(v.endDate);
      if (e < monthStart || s > monthEnd) continue;
      const start = s < monthStart ? monthStart : s;
      const end = e > monthEnd ? monthEnd : e;
      let cur = new Date(start);
      while (cur <= end) {
        const ds = cur.toISOString().split("T")[0];
        if (!m.has(ds)) m.set(ds, new Set());
        m.get(ds)!.add(v.employeeId);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return m;
  }

  private async checkOverlap(
    employeeId: string,
    startDate: string,
    endDate: string,
    excludeId?: string
  ): Promise<void> {
    const year = new Date(startDate).getFullYear();
    const snap = await this.vacationsCollection.get();
    const newS = new Date(startDate),
      newE = new Date(endDate);
    for (const doc of snap.docs) {
      if (excludeId && doc.id === excludeId) continue;
      const v = doc.data() as Vacation;
      if (v.year !== year || v.employeeId !== employeeId) continue;
      const s = new Date(v.startDate),
        e = new Date(v.endDate);
      if (newS <= e && newE >= s) throw new Error("Conflito de feriados");
    }
  }
}
export const vacationService = new VacationService();
