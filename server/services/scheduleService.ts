import { adminDb } from "../firebase-admin";
import type { Employee, Holiday, ScheduleEntry, Assignment } from "@shared/schema";
import { getWeekNumber, isWeekend, isHoliday, normalizeTime } from "@shared/schema";

export class ScheduleService {
  private employeesCollection = adminDb.collection('employees');
  private holidaysCollection = adminDb.collection('holidays');
  private scheduleCollection = adminDb.collection('schedule');

  async generateMonthlySchedule(year: number, month: number): Promise<ScheduleEntry[]> {
    // Get all active employees
    const employeesSnapshot = await this.employeesCollection.where('isActive', '==', true).get();
    const employees: Employee[] = employeesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Employee[];

    // Get all holidays
    const holidaysSnapshot = await this.holidaysCollection.get();
    const holidays: Holiday[] = holidaysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Holiday[];

    // Get days in month
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const scheduleEntries: ScheduleEntry[] = [];

    // Track weekend rotation state
    const weekendRotationEmployees = employees.filter(emp => emp.weekendRotation);

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month - 1, day);
      const dateString = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      const weekNumber = getWeekNumber(date);
      const isEvenWeek = weekNumber % 2 === 0;

      // Check if this day is a holiday
      const holiday = isHoliday(date, holidays);
      
      const assignments: Assignment[] = [];

      // If it's a holiday, no assignments
      if (holiday) {
        scheduleEntries.push({
          id: `${dateString}`,
          date: dateString,
          assignments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        continue;
      }

      // Generate assignments for each employee
      for (const employee of employees) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];

        // Check if employee works on this day
        if (!employee.workDays.includes(dayName as any)) {
          continue;
        }

        // Handle weekend rotation
        if (employee.weekendRotation && isWeekend(date)) {
          // For weekend rotation, alternate employees between Saturday and Sunday
          const employeeIndex = weekendRotationEmployees.findIndex(emp => emp.id === employee.id);
          
          if (dayOfWeek === 6) { // Saturday
            // Even weeks: even indexed employees, Odd weeks: odd indexed employees
            if ((isEvenWeek && employeeIndex % 2 === 0) || (!isEvenWeek && employeeIndex % 2 === 1)) {
              // This employee works this Saturday
            } else {
              continue;
            }
          } else if (dayOfWeek === 0) { // Sunday
            // Opposite of Saturday logic
            if ((isEvenWeek && employeeIndex % 2 === 1) || (!isEvenWeek && employeeIndex % 2 === 0)) {
              // This employee works this Sunday
            } else {
              continue;
            }
          }
        }

        // Get employee schedule for this day
        let startTime = employee.defaultStartTime;
        let endTime = employee.defaultEndTime;

        // Check for custom schedule
        if (employee.customSchedule && employee.customSchedule[dayName]) {
          startTime = employee.customSchedule[dayName].startTime;
          endTime = employee.customSchedule[dayName].endTime;
        }

        assignments.push({
          id: `${employee.id}-${dateString}`,
          employeeId: employee.id,
          employeeName: employee.name,
          startTime: normalizeTime(startTime),
          endTime: normalizeTime(endTime),
        });
      }

      scheduleEntries.push({
        id: `${dateString}`,
        date: dateString,
        assignments,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Save all schedule entries to Firestore
    const batch = adminDb.batch();
    
    for (const entry of scheduleEntries) {
      const docRef = this.scheduleCollection.doc(entry.id);
      batch.set(docRef, entry);
    }

    await batch.commit();

    return scheduleEntries;
  }

  async getMonthlySchedule(year: number, month: number): Promise<ScheduleEntry[]> {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

    const snapshot = await this.scheduleCollection
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ScheduleEntry[];
  }

  async updateDaySchedule(date: string, assignments: Assignment[]): Promise<ScheduleEntry> {
    const docRef = this.scheduleCollection.doc(date);
    const scheduleEntry: ScheduleEntry = {
      id: date,
      date,
      assignments,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(scheduleEntry);
    return scheduleEntry;
  }

  // PHASE 4: Weekend schedule generation
  async generateWeekendSchedule(year: number, month: number): Promise<number> {
    console.log(`[WeekendSchedule] Generating weekend schedule for ${month}/${year}`);
    
    // Get all active employees with weekend rotation
    const employeesSnapshot = await this.employeesCollection
      .where('isActive', '==', true)
      .where('weekendRotation', '==', true)
      .get();
    
    const weekendEmployees: Employee[] = employeesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Employee[];

    if (weekendEmployees.length === 0) {
      console.log(`[WeekendSchedule] No employees with weekend rotation found`);
      return 0;
    }

    // Get all holidays
    const holidaysSnapshot = await this.holidaysCollection.get();
    const holidays: Holiday[] = holidaysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Holiday[];

    // Get days in month
    const lastDay = new Date(year, month, 0);
    let daysGenerated = 0;
    let employeeIndex = 0;

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month - 1, day);
      const dateString = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();

      // Only process Saturday (6) and Sunday (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        continue;
      }

      // Check if it's a holiday
      if (isHoliday(date, holidays)) {
        console.log(`[WeekendSchedule] Skipping holiday: ${dateString}`);
        continue;
      }

      // Get the employee for this weekend day (round-robin)
      const employee = weekendEmployees[employeeIndex % weekendEmployees.length];
      employeeIndex++;

      // Create assignment
      const assignment: Assignment = {
        id: `${employee.id}-${dateString}`,
        employeeId: employee.id,
        employeeName: employee.name,
        startTime: employee.defaultStartTime,
        endTime: employee.defaultEndTime,
      };

      // Get existing schedule entry or create new one
      const scheduleRef = this.scheduleCollection.doc(dateString);
      const existingDoc = await scheduleRef.get();
      
      if (existingDoc.exists) {
        const existingData = existingDoc.data();
        const existingAssignments = existingData?.assignments || [];
        
        // Remove existing weekend rotation employees from this day
        const filteredAssignments = existingAssignments.filter(
          (a: Assignment) => !weekendEmployees.some(emp => emp.id === a.employeeId)
        );
        
        // Add new assignment
        filteredAssignments.push(assignment);
        
        await scheduleRef.update({
          assignments: filteredAssignments,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create new schedule entry
        const scheduleEntry = {
          date: dateString,
          assignments: [assignment],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await scheduleRef.set(scheduleEntry);
      }

      console.log(`[WeekendSchedule] Assigned ${employee.name} to ${dateString} (${dayOfWeek === 0 ? 'Sunday' : 'Saturday'})`);
      daysGenerated++;
    }

    console.log(`[WeekendSchedule] ✅ Generated ${daysGenerated} weekend assignments`);
    return daysGenerated;
  }
}

export const scheduleService = new ScheduleService();
