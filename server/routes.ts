import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { scheduleService } from "./services/scheduleService";
import { vacationService } from "./services/vacationService";
import { requireAuth, optionalAuth, type AuthenticatedRequest } from "./middleware/auth";
import { insertEmployeeSchema, updateEmployeeSchema, insertHolidaySchema, generateMonthlyScheduleSchema, insertAssignmentSchema, insertVacationSchema, updateVacationSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Employee routes
  app.get("/api/employees", async (req, res) => {
    try {
      const employees = await scheduleService.getAllEmployees();
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
      const employee = await scheduleService.createEmployee(employeeData);
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
      const employee = await scheduleService.updateEmployee(id, updateData);
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
      await scheduleService.deleteEmployee(id);
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
      const holidays = await scheduleService.getAllHolidays();
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
      const holiday = await scheduleService.createHoliday(holidayData);
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
      await scheduleService.deleteHoliday(id);
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

  // Vacation routes
  app.get("/api/vacations", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string);
      const employeeId = req.query.employeeId as string;
      
      if (isNaN(year)) {
        return res.status(400).json({ message: "Year parameter is required and must be a valid number" });
      }
      
      const vacations = await vacationService.list(year, employeeId);
      res.json(vacations);
    } catch (error) {
      console.error("Get vacations error:", error);
      res.status(500).json({ 
        message: "Failed to get vacations",
        detail: error.message,
        code: error.code || "UNKNOWN_ERROR"
      });
    }
  });

  app.post("/api/vacations", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const vacationData = insertVacationSchema.parse(req.body);
      
      // Get employee name
      const employees = await scheduleService.getAllEmployees();
      const employee = employees.find(emp => emp.id === vacationData.employeeId);
      
      if (!employee) {
        return res.status(400).json({ message: "Funcionário não encontrado" });
      }
      
      const vacation = await vacationService.create(vacationData, employee.name);
      
      // Invalidate cache for affected months
      const startMonth = new Date(vacation.startDate).getMonth() + 1;
      const endMonth = new Date(vacation.endDate).getMonth() + 1;
      // TODO: Invalidate schedule cache for affected months
      
      res.status(201).json(vacation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Create vacation error:", error);
        const statusCode = error.message.includes('conflita') ? 409 : 
                          error.message.includes('atravessar') ? 400 : 500;
        res.status(statusCode).json({ 
          message: "Failed to create vacation",
          detail: error.message,
          code: error.code || "UNKNOWN_ERROR"
        });
      }
    }
  });

  app.patch("/api/vacations/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updateData = updateVacationSchema.parse(req.body);
      
      const vacation = await vacationService.update(id, updateData);
      
      // TODO: Invalidate cache for affected months
      
      res.json(vacation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Update vacation error:", error);
        const statusCode = error.message.includes('conflita') ? 409 : 
                          error.message.includes('atravessar') ? 400 : 
                          error.message.includes('não encontrado') ? 404 : 500;
        res.status(statusCode).json({ 
          message: "Failed to update vacation",
          detail: error.message,
          code: error.code || "UNKNOWN_ERROR"
        });
      }
    }
  });

  app.delete("/api/vacations/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await vacationService.remove(id);
      
      // TODO: Invalidate cache for affected months
      
      res.status(204).send();
    } catch (error) {
      console.error("Delete vacation error:", error);
      const statusCode = error.message.includes('não encontrado') ? 404 : 500;
      res.status(statusCode).json({ 
        message: "Failed to delete vacation",
        detail: error.message,
        code: error.code || "UNKNOWN_ERROR"
      });
    }
  });

  // Schedule routes - NEW: Monthly consolidated approach
  app.get("/api/schedule/:year/:month", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      const forceRegenerate = req.query.forceRegenerate === 'true';
      
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: "Invalid year or month" });
      }

      const etag = req.headers['if-none-match'];
      
      try {
        const result = await scheduleService.getScheduleForMonth(year, month, etag, forceRegenerate);
        
        // Set ETag for caching
        res.set('ETag', result.etag);
        res.set('Cache-Control', 'private, max-age=60');
        
        // Log cache performance
        console.log(`[SCHEDULE] GET ${year}-${month}: ${result.fromCache ? 'CACHE HIT' : 'CACHE MISS'}`);
        
        res.json(result.schedule);
      } catch (error) {
        if (error.message === 'NOT_MODIFIED') {
          return res.status(304).send();
        }
        throw error;
      }
    } catch (error) {
      console.error("Get schedule error:", error);
      res.status(500).json({ 
        message: "Failed to get schedule",
        detail: error.message,
        code: error.code || "UNKNOWN_ERROR"
      });
    }
  });

  // NEW: Weekend schedule generation with monthly rotation
  app.post("/api/schedule/generate-weekends", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      console.log(`[WEEKEND] Received request:`, req.body);
      const { year, month } = req.body;
      
      // Validate parameters
      if (!year || !month || isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ 
          message: "Invalid parameters", 
          errorId: "INVALID_PARAMS" 
        });
      }
      
      console.log(`[WEEKEND] Starting weekend generation for ${month}/${year}`);
      
      const result = await scheduleService.generateWeekendSchedule(year, month);
      
      console.log(`[WEEKEND] ✅ Generated: ${result.daysUpdated} days updated`);
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        console.error("Generate weekend schedule error:", error);
        res.status(500).json({ 
          message: "Failed to generate weekend schedule",
          detail: error.message,
          errorId: "EXECUTION_ERROR"
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
