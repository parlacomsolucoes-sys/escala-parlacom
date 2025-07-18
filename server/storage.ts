import { adminDb } from "./firebase-admin";
import type {
  Employee,
  Holiday,
  InsertEmployee,
  InsertHoliday,
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
}

export class FirestoreStorage implements IStorage {
  private employeesCollection = adminDb.collection("employees");
  private holidaysCollection = adminDb.collection("holidays");

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
      return { id: docRef.id, ...employee };
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
    const holiday: Omit<Holiday, "id"> = {
      ...holidayData,
      createdAt: now,
      updatedAt: now,
    };

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
}

export const storage = new FirestoreStorage();
