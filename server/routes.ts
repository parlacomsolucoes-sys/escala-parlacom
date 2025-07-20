// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import { scheduleService } from "./services/scheduleService";
import { vacationService } from "./services/vacationService";
import { requireAuth, type AuthenticatedRequest } from "./middleware/auth";
import {
  insertEmployeeSchema,
  updateEmployeeSchema,
  insertHolidaySchema,
  generateMonthlyScheduleSchema,
  insertAssignmentSchema,
  insertVacationSchema,
  updateVacationSchema,
} from "@shared/schema";
import { z } from "zod";

/**
 * Registra todas as rotas e retorna o http.Server (para Vite ou produção)
 */
export async function registerRoutes(app: Express): Promise<Server> {
  /* =========================================================
   * EMPLOYEES
   * =======================================================*/
  app.get("/api/employees", async (_req, res) => {
    try {
      const employees = await scheduleService.getAllEmployees();
      res.json(employees);
    } catch (error: any) {
      console.error("Get employees error:", error);
      res.status(500).json({
        message: "Failed to get employees",
        detail: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  });

  app.post(
    "/api/employees",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const employeeData = insertEmployeeSchema.parse(req.body);
        const employee = await scheduleService.createEmployee(employeeData);
        res.status(201).json(employee);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        } else {
          console.error("Create employee error:", error);
          res.status(500).json({
            message: "Failed to create employee",
            detail: error.message,
            code: error.code || "UNKNOWN_ERROR",
          });
        }
      }
    }
  );

  app.patch(
    "/api/employees/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const updateData = updateEmployeeSchema
          .omit({ id: true })
          .parse(req.body);
        const employee = await scheduleService.updateEmployee(id, updateData);
        res.json(employee);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        } else {
          console.error("Update employee error:", error);
          res.status(500).json({
            message: "Failed to update employee",
            detail: error.message,
            code: error.code || "UNKNOWN_ERROR",
          });
        }
      }
    }
  );

  app.delete(
    "/api/employees/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await scheduleService.deleteEmployee(req.params.id);
        res.status(204).send();
      } catch (error: any) {
        console.error("Delete employee error:", error);
        res.status(500).json({
          message: "Failed to delete employee",
          detail: error.message,
          code: error.code || "UNKNOWN_ERROR",
        });
      }
    }
  );

  /* =========================================================
   * HOLIDAYS
   * =======================================================*/
  app.get("/api/holidays", async (_req, res) => {
    try {
      const holidays = await scheduleService.getAllHolidays();
      res.json(holidays);
    } catch (error: any) {
      console.error("Get holidays error:", error);
      res.status(500).json({
        message: "Failed to get holidays",
        detail: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  });

  app.post(
    "/api/holidays",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const holidayData = insertHolidaySchema.parse(req.body);
        const holiday = await scheduleService.createHoliday(holidayData);
        res.status(201).json(holiday);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        } else {
          console.error("Create holiday error:", error);
          res.status(500).json({
            message: "Failed to create holiday",
            detail: error.message,
            code: error.code || "UNKNOWN_ERROR",
          });
        }
      }
    }
  );

  app.delete(
    "/api/holidays/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await scheduleService.deleteHoliday(req.params.id);
        res.status(204).send();
      } catch (error: any) {
        console.error("Delete holiday error:", error);
        res.status(500).json({
          message: "Failed to delete holiday",
          detail: error.message,
          code: error.code || "UNKNOWN_ERROR",
        });
      }
    }
  );

  /* =========================================================
   * VACATIONS
   * =======================================================*/
  app.get("/api/vacations", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string);
      const employeeId = req.query.employeeId as string | undefined;
      if (isNaN(year)) {
        return res.status(400).json({
          message: "Year parameter is required and must be a valid number",
        });
      }
      const vacations = await vacationService.list(year, employeeId);
      res.json(vacations);
    } catch (error: any) {
      console.error("Get vacations error:", error);
      res.status(500).json({
        message: "Failed to get vacations",
        detail: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  });

  app.post(
    "/api/vacations",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const vacationData = insertVacationSchema.parse(req.body);
        const employees = await scheduleService.getAllEmployees();
        const employee = employees.find(
          (e) => e.id === vacationData.employeeId
        );
        if (!employee) {
          return res
            .status(400)
            .json({ message: "Funcionário não encontrado" });
        }
        const vacation = await vacationService.create(
          vacationData,
          employee.name
        );
        res.status(201).json(vacation);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        } else {
          const statusCode = error.message.includes("conflita")
            ? 409
            : error.message.includes("atravessar")
            ? 400
            : 500;
          console.error("Create vacation error:", error);
          res.status(statusCode).json({
            message: "Failed to create vacation",
            detail: error.message,
            code: error.code || "UNKNOWN_ERROR",
          });
        }
      }
    }
  );

  app.patch(
    "/api/vacations/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const updateData = updateVacationSchema.parse(req.body);
        const vacation = await vacationService.update(
          req.params.id,
          updateData
        );
        res.json(vacation);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        } else {
          const statusCode = error.message.includes("conflita")
            ? 409
            : error.message.includes("atravessar")
            ? 400
            : error.message.includes("não encontrado")
            ? 404
            : 500;
          console.error("Update vacation error:", error);
          res.status(statusCode).json({
            message: "Failed to update vacation",
            detail: error.message,
            code: error.code || "UNKNOWN_ERROR",
          });
        }
      }
    }
  );

  app.delete(
    "/api/vacations/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await vacationService.remove(req.params.id);
        res.status(204).send();
      } catch (error: any) {
        const status = error.message.includes("não encontrado") ? 404 : 500;
        console.error("Delete vacation error:", error);
        res.status(status).json({
          message: "Failed to delete vacation",
          detail: error.message,
          code: error.code || "UNKNOWN_ERROR",
        });
      }
    }
  );

  /* =========================================================
   * SCHEDULE (Monthly)
   * =======================================================*/
  app.get("/api/schedule/:year/:month", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      const forceRegenerate = req.query.forceRegenerate === "true";
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: "Invalid year or month" });
      }
      const etag = req.headers["if-none-match"] as string | undefined;

      try {
        const result = await scheduleService.getScheduleForMonth(
          year,
          month,
          etag,
          forceRegenerate
        );
        res.set("ETag", result.etag);
        res.set("Cache-Control", "private, max-age=60");
        res.json(result.schedule);
      } catch (err: any) {
        if (err.message === "NOT_MODIFIED") {
          return res.status(304).send();
        }
        throw err;
      }
    } catch (error: any) {
      console.error("Get schedule error:", error);
      res.status(500).json({
        message: "Failed to get schedule",
        detail: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  });

  // Gerar/recriar escala mensal (sem assignments automáticos por funcionário a menos que você implemente)
  app.post(
    "/api/schedule/generate",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { year, month } = generateMonthlyScheduleSchema.parse(req.body);
        // Força recriação
        const result = await scheduleService.getScheduleForMonth(
          year,
          month,
          undefined,
          true
        );
        res.status(201).json(result.schedule);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        } else {
          console.error("Generate schedule error:", error);
          res.status(500).json({
            message: "Failed to generate schedule",
            detail: error.message,
            code: error.code || "UNKNOWN_ERROR",
          });
        }
      }
    }
  );

  // Gerar somente finais de semana (rotaciona)
  app.post(
    "/api/schedule/generate-weekends",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { year, month } = req.body;
        if (
          !year ||
          !month ||
          isNaN(Number(year)) ||
          isNaN(Number(month)) ||
          month < 1 ||
          month > 12
        ) {
          return res
            .status(400)
            .json({ message: "Invalid parameters", errorId: "INVALID_PARAMS" });
        }
        const result = await scheduleService.generateWeekendSchedule(
          Number(year),
          Number(month)
        );
        res.status(201).json(result);
      } catch (error: any) {
        console.error("Generate weekend schedule error:", error);
        res.status(500).json({
          message: "Failed to generate weekend schedule",
          detail: error.message,
          errorId: "EXECUTION_ERROR",
        });
      }
    }
  );

  // Atualizar um dia manualmente
  app.patch(
    "/api/schedule/day/:date",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { date } = req.params;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res
            .status(400)
            .json({ message: "Invalid date format. Use YYYY-MM-DD" });
        }
        const { assignments } = req.body;
        const validatedAssignments = z
          .array(insertAssignmentSchema)
          .parse(assignments);

        const withIds = validatedAssignments.map((a) => ({
          ...a,
          id: `${a.employeeId}-${date}`,
        }));

        const updated = await scheduleService.updateDaySchedule(date, withIds);
        res.json(updated);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          res
            .status(400)
            .json({ message: "Validation error", errors: error.errors });
        } else {
          console.error("Update day schedule error:", error);
          res
            .status(500)
            .json({
              message: "Failed to update day schedule",
              detail: error.message,
            });
        }
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}
