import { adminDb } from "./firebase-admin";
import { isHoliday } from "@shared/schema";
import type {
  Employee,
  Holiday,
  InsertEmployee,
  InsertHoliday,
  ScheduleEntry,
  Assignment,
} from "@shared/schema";

export interface IStorage {
  // Employees
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(
    id: string,
    employee: Partial<InsertEmployee>
  ): Promise<Employee>;
  deleteEmployee(id: string): Promise<void>;

  // Holidays
  getHolidays(): Promise<Holiday[]>;
  getHoliday(id: string): Promise<Holiday | undefined>;
  createHoliday(holiday: InsertHoliday): Promise<Holiday>;
  updateHoliday(id: string, holiday: Partial<InsertHoliday>): Promise<Holiday>;
  deleteHoliday(id: string): Promise<void>;

  // Schedule entries
  getScheduleEntry(date: string): Promise<ScheduleEntry | undefined>;
  createScheduleEntry(entry: ScheduleEntry): Promise<ScheduleEntry>;
  updateScheduleEntry(date: string, entry: Partial<ScheduleEntry>): Promise<ScheduleEntry>;
}

export class FirestoreStorage implements IStorage {
  private employeesCollection = adminDb.collection("employees");
  private holidaysCollection = adminDb.collection("holidays");
  private scheduleCollection = adminDb.collection("schedule");

  /* -------------------------------------------------------------------------- */
  /*                               EMPLOYEES                                    */
  /* -------------------------------------------------------------------------- */

  async getEmployees(): Promise<Employee[]> {
    const snapshot = await this.employeesCollection.orderBy("name").get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Employee[];
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const doc = await this.employeesCollection.doc(id).get();
    if (!doc.exists) return undefined;
    return { id: doc.id, ...doc.data() } as Employee;
  }

  async createEmployee(employeeData: InsertEmployee): Promise<Employee> {
    console.log("[FirestoreStorage] Dados recebidos para criação:", JSON.stringify(employeeData, null, 2));
    
    const now = new Date().toISOString();
    const employee: Omit<Employee, "id"> = {
      ...employeeData,
      createdAt: now,
      updatedAt: now,
    };

    console.log("[FirestoreStorage] Objeto final para Firestore:", JSON.stringify(employee, null, 2));
    
    try {
      console.log("[FirestoreStorage] Enviando para collection 'employees'...");
      const docRef = await this.employeesCollection.add(employee);
      console.log("[FirestoreStorage] ✅ Employee criado com ID:", docRef.id);
      
      const newEmployee = { id: docRef.id, ...employee };
      
      // PHASE 2: Auto-schedule remaining days of current month
      try {
        await this.autoScheduleRemainingMonth(newEmployee);
      } catch (error) {
        console.warn("[FirestoreStorage] ⚠️ Erro ao criar agenda automática:", error.message);
      }
      
      return newEmployee;
    } catch (error) {
      console.error("[FirestoreStorage] ❌ Erro ao criar employee:", {
        message: error.message,
        code: error.code,
        details: error.details,
        stack: error.stack
      });
      throw error;
    }
  }

  private async autoScheduleRemainingMonth(employee: Employee): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const today = now.getDate();
    
    // Get last day of current month
    const lastDay = new Date(year, month, 0).getDate();
    
    // Get all holidays for comparison
    const holidays = await this.getHolidays();
    
    console.log(`[AutoSchedule] Criando agenda para ${employee.name} do dia ${today} até ${lastDay}/${month}/${year}`);
    
    let daysScheduled = 0;
    
    for (let day = today; day <= lastDay; day++) {
      const date = new Date(year, month - 1, day);
      const dateString = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];
      
      // Check if employee works on this day
      if (!employee.workDays.includes(dayName as any)) {
        continue;
      }
      
      // Check if it's a holiday
      if (isHoliday(date, holidays)) {
        console.log(`[AutoSchedule] Pulando feriado: ${dateString}`);
        continue;
      }
      
      // Determine working hours
      const customSchedule = employee.customSchedule?.[dayName];
      const startTime = customSchedule?.startTime || employee.defaultStartTime;
      const endTime = customSchedule?.endTime || employee.defaultEndTime;
      
      // Create assignment
      const assignment: Assignment = {
        id: `${employee.id}-${dateString}`,
        employeeId: employee.id,
        employeeName: employee.name,
        startTime,
        endTime
      };
      
      try {
        await this.addAssignmentToSchedule(dateString, assignment);
        daysScheduled++;
      } catch (error) {
        console.warn(`[AutoSchedule] Erro ao agendar dia ${dateString}:`, error.message);
      }
    }
    
    console.log(`[AutoSchedule] ✅ Agenda criada: ${daysScheduled} dias agendados para ${employee.name}`);
  }

  private async addAssignmentToSchedule(dateString: string, assignment: Assignment): Promise<void> {
    const scheduleRef = this.scheduleCollection.doc(dateString);
    const scheduleDoc = await scheduleRef.get();
    
    if (scheduleDoc.exists) {
      // Update existing schedule entry
      const existingData = scheduleDoc.data();
      const assignments = existingData?.assignments || [];
      
      // Check if assignment already exists for this employee
      const existingAssignmentIndex = assignments.findIndex(
        (a: Assignment) => a.employeeId === assignment.employeeId
      );
      
      if (existingAssignmentIndex >= 0) {
        // Update existing assignment
        assignments[existingAssignmentIndex] = assignment;
      } else {
        // Add new assignment
        assignments.push(assignment);
      }
      
      await scheduleRef.update({
        assignments,
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
  }

  async updateEmployee(
    id: string,
    employeeData: Partial<InsertEmployee>
  ): Promise<Employee> {
    const now = new Date().toISOString();

    // 🔧 Remove campos undefined antes de enviar ao Firestore
    const sanitized = Object.fromEntries(
      Object.entries(employeeData).filter(([, v]) => v !== undefined)
    );

    await this.employeesCollection.doc(id).update({
      ...sanitized,
      updatedAt: now,
    });

    const updatedDoc = await this.employeesCollection.doc(id).get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as Employee;
  }

  async deleteEmployee(id: string): Promise<void> {
    await this.employeesCollection.doc(id).delete();
  }

  /* -------------------------------------------------------------------------- */
  /*                                 HOLIDAYS                                   */
  /* -------------------------------------------------------------------------- */

  async getHolidays(): Promise<Holiday[]> {
    const snapshot = await this.holidaysCollection.orderBy("date").get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Holiday[];
  }

  async getHoliday(id: string): Promise<Holiday | undefined> {
    const doc = await this.holidaysCollection.doc(id).get();
    if (!doc.exists) return undefined;
    return { id: doc.id, ...doc.data() } as Holiday;
  }

  async createHoliday(holidayData: InsertHoliday): Promise<Holiday> {
    const now = new Date().toISOString();
    
    // Normalize date to MM-DD format before saving
    let normalizedDate = holidayData.date;
    if (normalizedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      normalizedDate = normalizedDate.substring(5); // Keep only MM-DD
    }
    
    const holiday: Omit<Holiday, "id"> = {
      ...holidayData,
      date: normalizedDate,
      createdAt: now,
      updatedAt: now,
    };

    console.log(`[Storage] Criando feriado com data normalizada: ${normalizedDate}`);
    const docRef = await this.holidaysCollection.add(holiday);
    return { id: docRef.id, ...holiday };
  }

  async updateHoliday(
    id: string,
    holidayData: Partial<InsertHoliday>
  ): Promise<Holiday> {
    const now = new Date().toISOString();

    // 🔧 Remove campos undefined
    const sanitized = Object.fromEntries(
      Object.entries(holidayData).filter(([, v]) => v !== undefined)
    );

    // Normalize date to MM-DD format if provided
    if (sanitized.date && typeof sanitized.date === 'string') {
      if (sanitized.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        sanitized.date = sanitized.date.substring(5); // Keep only MM-DD
      }
    }

    await this.holidaysCollection.doc(id).update({
      ...sanitized,
      updatedAt: now,
    });

    const updatedDoc = await this.holidaysCollection.doc(id).get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as Holiday;
  }

  async deleteHoliday(id: string): Promise<void> {
    await this.holidaysCollection.doc(id).delete();
  }

  /* -------------------------------------------------------------------------- */
  /*                              SCHEDULE ENTRIES                             */
  /* -------------------------------------------------------------------------- */

  async getScheduleEntry(date: string): Promise<ScheduleEntry | undefined> {
    const doc = await this.scheduleCollection.doc(date).get();
    if (!doc.exists) return undefined;
    return { id: doc.id, ...doc.data() } as ScheduleEntry;
  }

  async createScheduleEntry(entry: ScheduleEntry): Promise<ScheduleEntry> {
    const now = new Date().toISOString();
    const scheduleEntry = {
      ...entry,
      createdAt: now,
      updatedAt: now,
    };

    await this.scheduleCollection.doc(entry.date).set(scheduleEntry);
    return { id: entry.date, ...scheduleEntry };
  }

  async updateScheduleEntry(date: string, entry: Partial<ScheduleEntry>): Promise<ScheduleEntry> {
    const now = new Date().toISOString();
    const sanitized = Object.fromEntries(
      Object.entries(entry).filter(([, v]) => v !== undefined)
    );

    await this.scheduleCollection.doc(date).update({
      ...sanitized,
      updatedAt: now,
    });

    const updatedDoc = await this.scheduleCollection.doc(date).get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as ScheduleEntry;
  }
}

export const storage = new FirestoreStorage();
