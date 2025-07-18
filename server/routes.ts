import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scheduleService } from "./services/scheduleService";
import { requireAuth, optionalAuth, type AuthenticatedRequest } from "./middleware/auth";
import { insertEmployeeSchema, updateEmployeeSchema, insertHolidaySchema, generateMonthlyScheduleSchema, insertAssignmentSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Employee routes
  app.get("/api/employees", async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      res.json(employees);
    } catch (error) {
      console.error("Get employees error:", error);
      res.status(500).json({ 
        message: "Failed to get employees",
        detail: error.message,
        code: error.code || "UNKNOWN_ERROR"
      });
    }
  });

  app.post("/api/employees", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      console.log("[POST /api/employees] Recebido body:", JSON.stringify(req.body, null, 2));
      console.log("[POST /api/employees] Usuario autenticado:", req.user);
      
      const employeeData = insertEmployeeSchema.parse(req.body);
      console.log("[POST /api/employees] Dados validados:", JSON.stringify(employeeData, null, 2));
      
      console.log("[Firestore] Tentando criar employee...");
      const employee = await storage.createEmployee(employeeData);
      console.log("[POST /api/employees] Employee criado com sucesso:", employee.id);
      
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("[POST /api/employees] Erro de validação Zod:", error.errors);
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("[POST /api/employees] Erro detalhado:", {
          message: error.message,
          code: error.code,
          details: error.details,
          stack: error.stack,
          name: error.constructor.name
        });
        res.status(500).json({ 
          message: "Failed to create employee",
          detail: error.message,
          code: error.code || "UNKNOWN_ERROR"
        });
      }
    }
  });

  app.patch("/api/employees/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updateData = updateEmployeeSchema.omit({ id: true }).parse(req.body);
      const employee = await storage.updateEmployee(id, updateData);
      res.json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Update employee error:", error);
        res.status(500).json({ 
          message: "Failed to update employee",
          detail: error.message,
          code: error.code || "UNKNOWN_ERROR"
        });
      }
    }
  });

  app.delete("/api/employees/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deleteEmployee(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete employee error:", error);
      res.status(500).json({ 
        message: "Failed to delete employee",
        detail: error.message,
        code: error.code || "UNKNOWN_ERROR"
      });
    }
  });

  // Holiday routes
  app.get("/api/holidays", async (req, res) => {
    try {
      const holidays = await storage.getHolidays();
      res.json(holidays);
    } catch (error) {
      console.error("Get holidays error:", error);
      res.status(500).json({ 
        message: "Failed to get holidays",
        detail: error.message,
        code: error.code || "UNKNOWN_ERROR"
      });
    }
  });

  app.post("/api/holidays", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const holidayData = insertHolidaySchema.parse(req.body);
      const holiday = await storage.createHoliday(holidayData);
      res.status(201).json(holiday);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Create holiday error:", error);
        res.status(500).json({ 
          message: "Failed to create holiday",
          detail: error.message,
          code: error.code || "UNKNOWN_ERROR"
        });
      }
    }
  });

  app.delete("/api/holidays/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deleteHoliday(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete holiday error:", error);
      res.status(500).json({ 
        message: "Failed to delete holiday",
        detail: error.message,
        code: error.code || "UNKNOWN_ERROR"
      });
    }
  });

  // Schedule routes
  app.get("/api/schedule/:year/:month", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: "Invalid year or month" });
      }

      const schedule = await scheduleService.getMonthlySchedule(year, month);
      res.json(schedule);
    } catch (error) {
      console.error("Get schedule error:", error);
      res.status(500).json({ 
        message: "Failed to get schedule",
        detail: error.message,
        code: error.code || "UNKNOWN_ERROR"
      });
    }
  });

  // PHASE 4: Weekend schedule generation route
  app.post("/api/schedule/generate-weekends", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { year, month } = generateMonthlyScheduleSchema.parse(req.body);
      const scheduleService = new ScheduleService();
      const daysGenerated = await scheduleService.generateWeekendSchedule(year, month);
      
      console.log(`[WeekendSchedule] Generated ${daysGenerated} weekend days for ${month}/${year}`);
      
      res.status(201).json({ 
        message: "Weekend schedule generated successfully",
        daysGenerated,
        month,
        year
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Generate weekend schedule error:", error);
        res.status(500).json({ 
          message: "Failed to generate weekend schedule",
          detail: error.message,
          code: error.code || "UNKNOWN_ERROR"
        });
      }
    }
  });

  // Schedule generation route (kept for backwards compatibility)
  app.post("/api/schedule/generate", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { year, month } = generateMonthlyScheduleSchema.parse(req.body);
      const schedule = await scheduleService.generateMonthlySchedule(year, month);
      res.status(201).json(schedule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Generate schedule error:", error);
        res.status(500).json({ 
          message: "Failed to generate schedule",
          detail: error.message,
          code: error.code || "UNKNOWN_ERROR"
        });
      }
    }
  });

  app.patch("/api/schedule/day/:date", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { date } = req.params;
      const { assignments } = req.body;
      
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }

      // Validate assignments and add IDs
      const validatedAssignments = z.array(insertAssignmentSchema).parse(assignments);
      const assignmentsWithIds = validatedAssignments.map(assignment => ({
        ...assignment,
        id: `${assignment.employeeId}-${date}`
      }));
      
      const scheduleEntry = await scheduleService.updateDaySchedule(date, assignmentsWithIds);
      res.json(scheduleEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Update day schedule error:", error);
        res.status(500).json({ message: "Failed to update day schedule" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
