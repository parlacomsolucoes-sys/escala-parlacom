import { adminDb } from "../firebase-admin";
import type { Vacation, InsertVacation } from "@shared/schema";

export class VacationService {
  private vacationsCollection = adminDb.collection('vacations');

  async list(year: number, employeeId?: string): Promise<Vacation[]> {
    // Get all vacations and filter in application to avoid index requirements
    const snapshot = await this.vacationsCollection.get();
    
    let results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Vacation[];
    
    // Filter by year in application
    results = results.filter(vacation => vacation.year === year);
    
    // Filter by employeeId in application if specified
    if (employeeId) {
      results = results.filter(vacation => vacation.employeeId === employeeId);
    }
    
    // Sort by startDate in application
    results.sort((a, b) => a.startDate.localeCompare(b.startDate));
    
    return results;
  }

  async create(data: InsertVacation, employeeName: string): Promise<Vacation> {
    // Validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    
    if (startDate > endDate) {
      throw new Error('Data de início deve ser anterior ou igual à data de fim');
    }
    
    // Check if both dates are in the same year
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    
    if (startYear !== endYear) {
      throw new Error('Período de férias não pode atravessar anos. Divida em dois registros.');
    }
    
    // Check for overlaps with existing vacations for this employee
    await this.checkOverlap(data.employeeId, data.startDate, data.endDate);
    
    const docRef = this.vacationsCollection.doc();
    const vacation: Vacation = {
      id: docRef.id,
      employeeId: data.employeeId,
      employeeName,
      year: startYear,
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await docRef.set(vacation);
    return vacation;
  }

  async update(id: string, data: Partial<InsertVacation>): Promise<Vacation> {
    const docRef = this.vacationsCollection.doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new Error('Período de férias não encontrado');
    }
    
    const existingVacation = doc.data() as Vacation;
    
    // If updating dates, validate them
    if (data.startDate || data.endDate) {
      const newStartDate = data.startDate || existingVacation.startDate;
      const newEndDate = data.endDate || existingVacation.endDate;
      
      const startDate = new Date(newStartDate);
      const endDate = new Date(newEndDate);
      
      if (startDate > endDate) {
        throw new Error('Data de início deve ser anterior ou igual à data de fim');
      }
      
      // Check year consistency
      if (startDate.getFullYear() !== endDate.getFullYear()) {
        throw new Error('Período de férias não pode atravessar anos. Divida em dois registros.');
      }
      
      // Check for overlaps (excluding current vacation)
      await this.checkOverlap(existingVacation.employeeId, newStartDate, newEndDate, id);
      
      // Update year if dates changed
      if (data.startDate) {
        data.year = startDate.getFullYear();
      }
    }
    
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    await docRef.update(updateData);
    
    const updatedDoc = await docRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as Vacation;
  }

  async remove(id: string): Promise<void> {
    const docRef = this.vacationsCollection.doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new Error('Período de férias não encontrado');
    }
    
    await docRef.delete();
  }

  async isEmployeeOnVacation(employeeId: string, dateString: string): Promise<boolean> {
    const date = new Date(dateString);
    const year = date.getFullYear();
    
    // Get all vacations and filter in application
    const snapshot = await this.vacationsCollection.get();
    
    for (const doc of snapshot.docs) {
      const vacation = doc.data() as Vacation;
      
      // Filter by year and employeeId in application
      if (vacation.year !== year || vacation.employeeId !== employeeId) {
        continue;
      }
      
      const startDate = new Date(vacation.startDate);
      const endDate = new Date(vacation.endDate);
      
      if (date >= startDate && date <= endDate) {
        return true;
      }
    }
    
    return false;
  }

  async getEmployeesOnVacationForMonth(year: number, month: number): Promise<Map<string, Set<string>>> {
    // Get all vacations and filter by year in application
    const snapshot = await this.vacationsCollection.get();
    
    const vacationsByDate = new Map<string, Set<string>>();
    
    // Get the first and last day of the month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    for (const doc of snapshot.docs) {
      const vacation = doc.data() as Vacation;
      
      // Filter by year in application
      if (vacation.year !== year) {
        continue;
      }
      
      const vacationStart = new Date(vacation.startDate);
      const vacationEnd = new Date(vacation.endDate);
      
      // Check if vacation overlaps with the month
      if (vacationEnd >= monthStart && vacationStart <= monthEnd) {
        // Find the actual overlap period within the month
        const overlapStart = new Date(Math.max(vacationStart.getTime(), monthStart.getTime()));
        const overlapEnd = new Date(Math.min(vacationEnd.getTime(), monthEnd.getTime()));
        
        // Add each day in the overlap to the map
        const currentDate = new Date(overlapStart);
        while (currentDate <= overlapEnd) {
          const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
          
          if (!vacationsByDate.has(dateString)) {
            vacationsByDate.set(dateString, new Set());
          }
          
          vacationsByDate.get(dateString)!.add(vacation.employeeId);
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }
    
    return vacationsByDate;
  }

  private async checkOverlap(employeeId: string, startDate: string, endDate: string, excludeId?: string): Promise<void> {
    const year = new Date(startDate).getFullYear();
    
    // Get all vacations and filter in application
    const snapshot = await this.vacationsCollection.get();
    
    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);
    
    for (const doc of snapshot.docs) {
      if (excludeId && doc.id === excludeId) {
        continue; // Skip the vacation being updated
      }
      
      const existing = doc.data() as Vacation;
      
      // Filter by year and employeeId in application
      if (existing.year !== year || existing.employeeId !== employeeId) {
        continue;
      }
      
      const existingStart = new Date(existing.startDate);
      const existingEnd = new Date(existing.endDate);
      
      // Check for overlap: new vacation starts before existing ends AND new vacation ends after existing starts
      if (newStart <= existingEnd && newEnd >= existingStart) {
        throw new Error('Período de férias conflita com outro período existente para este funcionário');
      }
    }
  }
}

export const vacationService = new VacationService();