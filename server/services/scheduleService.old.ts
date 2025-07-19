import { adminDb } from "../firebase-admin";
import type { Employee, Holiday, MonthlySchedule, ScheduleDay, Assignment } from "@shared/schema";
import { 
  formatDate, 
  getMonthDays, 
  calcHolidayMap, 
  isWeekend, 
  isHolidayDate, 
  pickEmployeeDefaultTimes,
  getMonthlyScheduleId,
  generateETag
} from "@shared/utils/schedule";
import { normalizeTime } from "@shared/schema";

// In-memory cache for schedules
const scheduleCache = new Map<string, { data: MonthlySchedule; etag: string; ts: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

export class ScheduleService {
  private employeesCollection = adminDb.collection('employees');
  private holidaysCollection = adminDb.collection('holidays');
  private schedulesCollection = adminDb.collection('schedules'); // New collection for monthly docs

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
      const dateString = formatDateKey(date);
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

  // PHASE 2: Enhanced weekend rotation system with automatic alternation
  async generateWeekendSchedule(year: number, month: number, force: boolean = false): Promise<{
    daysGenerated: number;
    changedCount: number;
    skippedHolidays: string[];
    eligibleEmployees: number;
    totalWeekendDaysProcessed: number;
    employeesUsed: string[];
    pattern: string;
    updatedDays: string[];
  }> {
    console.log(`[WEEKEND] Generating weekend schedule for ${month}/${year}, force=${force}`);
    
    // Get all active employees with weekend rotation, sorted by name for determinism
    const employeesSnapshot = await this.employeesCollection
      .where('isActive', '==', true)
      .where('weekendRotation', '==', true)
      .get();
    
    const weekendEmployees: Employee[] = employeesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Employee[];

    // Sort by name for consistency
    weekendEmployees.sort((a, b) => a.name.localeCompare(b.name));

    if (weekendEmployees.length === 0) {
      console.log(`[WEEKEND] No employees with weekend rotation found`);
      return {
        daysGenerated: 0,
        changedCount: 0,
        skippedHolidays: [],
        eligibleEmployees: 0,
        totalWeekendDaysProcessed: 0,
        employeesUsed: [],
        pattern: "none",
        updatedDays: []
      };
    }

    console.log(`[WEEKEND] Found ${weekendEmployees.length} eligible employees:`, weekendEmployees.map(e => e.name));

    // Get rotation metadata for this month
    const rotationId = `${year}-${String(month).padStart(2, '0')}`;
    const rotationMeta = await this.getOrCreateRotationMeta(rotationId);

    // Get all holidays
    const holidaysSnapshot = await this.holidaysCollection.get();
    const holidays: Holiday[] = holidaysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Holiday[];

    // Get weekend days grouped by weeks
    const weekendWeeks = this.getWeekendWeeks(year, month);
    console.log(`[WEEKEND] Found ${weekendWeeks.length} weekend weeks in ${month}/${year}`);

    let daysGenerated = 0;
    let changedCount = 0;
    const skippedHolidays: string[] = [];
    const employeesUsed: string[] = [];
    const updatedDays: string[] = [];

    let currentRotationIndex = rotationMeta.rotationIndex;
    let currentSwapParity = rotationMeta.swapParity;

    // Process each weekend week
    for (const week of weekendWeeks) {
      const { saturday, sunday } = week;
      
      // Process Saturday and Sunday as a pair
      const weekendPair = [saturday, sunday].filter(date => date !== null);
      const assignments = this.calculateWeekendAssignments(
        weekendEmployees,
        currentRotationIndex,
        currentSwapParity,
        weekendPair
      );

      for (let i = 0; i < weekendPair.length; i++) {
        const date = weekendPair[i];
        const employee = assignments[i];
        
        const dateString = formatDateKey(date);
        const dayOfWeek = date.getDay();

        // Check if it's a holiday
        const holiday = isHoliday(date, holidays);
        if (holiday) {
          console.log(`[WEEKEND] ⏭️  Skipping ${dateString} (${holiday.name})`);
          skippedHolidays.push(dateString);
          continue;
        }

        // Get current schedule for this day
        const docRef = this.scheduleCollection.doc(dateString);
        const doc = await docRef.get();
        const existingSchedule = doc.exists ? doc.data() as ScheduleEntry : null;

        // Check if this employee is already assigned to this day
        const existingAssignment = existingSchedule?.assignments?.find(
          a => a.employeeId === employee.id
        );

        if (existingAssignment && !force) {
          console.log(`[WEEKEND] ⚡ ${dateString} already has correct assignment (${employee.name})`);
        } else {
          // Remove existing weekend rotation assignments from this day
          let assignments = existingSchedule?.assignments || [];
          assignments = assignments.filter(a => !weekendEmployees.some(we => we.id === a.employeeId));

          // Get employee's schedule for this day
          const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
          const customSchedule = employee.customSchedule?.[dayName];
          
          const startTime = customSchedule?.startTime || employee.defaultStartTime;
          const endTime = customSchedule?.endTime || employee.defaultEndTime;

          // Add new assignment
          const assignment: Assignment = {
            id: `${employee.id}-${dateString}`,
            employeeId: employee.id,
            employeeName: employee.name,
            startTime: normalizeTime(startTime),
            endTime: normalizeTime(endTime)
          };

          assignments.push(assignment);

          // Update the schedule
          const scheduleEntry: ScheduleEntry = {
            id: dateString,
            date: dateString,
            assignments,
            createdAt: existingSchedule?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await docRef.set(scheduleEntry);
          console.log(`[WEEKEND] ✅ Assigned ${employee.name} to ${dateString} (${dayOfWeek === 6 ? 'Saturday' : 'Sunday'})`);
          changedCount++;
          updatedDays.push(dateString);
        }

        if (!employeesUsed.includes(employee.name)) {
          employeesUsed.push(employee.name);
        }

        daysGenerated++;
      }

      // Update rotation for next week
      if (weekendEmployees.length === 2) {
        // Two employees: just swap parity
        currentSwapParity = 1 - currentSwapParity;
      } else if (weekendEmployees.length > 2) {
        // More than 2: advance index by 2 and swap parity
        currentRotationIndex = (currentRotationIndex + 2) % weekendEmployees.length;
        currentSwapParity = 1 - currentSwapParity;
      }
      // Single employee: no change needed
    }

    // Update rotation metadata
    await this.updateRotationMeta(rotationId, {
      rotationIndex: currentRotationIndex,
      swapParity: currentSwapParity,
      lastProcessedWeekendISO: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const pattern = weekendEmployees.length === 1 ? "single" : 
                   weekendEmployees.length === 2 ? "pair" : "multiple";

    console.log(`[WEEKEND] ✅ Complete:`, {
      daysGenerated,
      changedCount,
      skippedHolidays,
      eligibleEmployees: weekendEmployees.length,
      totalWeekendDaysProcessed: daysGenerated,
      employeesUsed,
      pattern,
      updatedDays
    });

    return {
      daysGenerated,
      changedCount,
      skippedHolidays,
      eligibleEmployees: weekendEmployees.length,
      totalWeekendDaysProcessed: daysGenerated,
      employeesUsed,
      pattern,
      updatedDays
    };
  }

  // Helper function to get or create rotation metadata
  private async getOrCreateRotationMeta(rotationId: string): Promise<RotationMeta> {
    const doc = await this.rotationMetaCollection.doc(rotationId).get();
    
    if (doc.exists) {
      return doc.data() as RotationMeta;
    }
    
    // Create new rotation metadata
    const newMeta: RotationMeta = {
      rotationIndex: 0,
      swapParity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await this.rotationMetaCollection.doc(rotationId).set(newMeta);
    return newMeta;
  }

  // Helper function to update rotation metadata
  private async updateRotationMeta(rotationId: string, updates: Partial<RotationMeta>): Promise<void> {
    await this.rotationMetaCollection.doc(rotationId).update(updates);
  }

  // Helper function to get weekend weeks in a month
  private getWeekendWeeks(year: number, month: number): Array<{ saturday: Date | null; sunday: Date | null }> {
    const weeks: Array<{ saturday: Date | null; sunday: Date | null }> = [];
    const lastDay = new Date(year, month, 0);
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      
      if (dayOfWeek === 6) { // Saturday
        // Look for next day (Sunday)
        const nextDay = new Date(year, month - 1, day + 1);
        const sunday = nextDay.getMonth() === month - 1 ? nextDay : null;
        
        weeks.push({ saturday: date, sunday });
      } else if (dayOfWeek === 0) { // Sunday
        // Check if we already have this sunday in a week
        const existingWeek = weeks.find(w => w.sunday?.getTime() === date.getTime());
        if (!existingWeek) {
          weeks.push({ saturday: null, sunday: date });
        }
      }
    }
    
    return weeks;
  }

  // Helper function to calculate weekend assignments based on rotation logic
  private calculateWeekendAssignments(
    employees: Employee[],
    rotationIndex: number,
    swapParity: number,
    weekendDates: Date[]
  ): Employee[] {
    if (employees.length === 0) return [];
    
    if (employees.length === 1) {
      // Single employee covers all weekend days
      return weekendDates.map(() => employees[0]);
    }
    
    if (employees.length === 2) {
      // Two employees: alternate based on parity
      const [emp1, emp2] = employees;
      if (swapParity === 0) {
        return weekendDates.map((_, index) => index % 2 === 0 ? emp1 : emp2);
      } else {
        return weekendDates.map((_, index) => index % 2 === 0 ? emp2 : emp1);
      }
    }
    
    // Multiple employees: use rotation index and parity
    const assignments: Employee[] = [];
    for (let i = 0; i < weekendDates.length; i++) {
      const employeeIndex = (rotationIndex + i) % employees.length;
      let employee = employees[employeeIndex];
      
      // Apply parity-based swapping for pairs
      if (swapParity === 1 && i % 2 === 0 && i + 1 < weekendDates.length) {
        const nextEmployeeIndex = (rotationIndex + i + 1) % employees.length;
        const nextEmployee = employees[nextEmployeeIndex];
        assignments.push(nextEmployee);
        assignments.push(employee);
        i++; // Skip next iteration as we handled both
      } else {
        assignments.push(employee);
      }
    }
    
    return assignments;
  }
}

export const scheduleService = new ScheduleService();
