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

export async function registerRoutes(app: Express): Promise<Server> {
  /* =====================================================
   * EMPLOYEES
   * ===================================================*/
  app.get("/api/employees", async (_req, res) => {
    try {
      const employees = await scheduleService.getAllEmployees();
      res.json(employees);
    } catch (err: any) {
      console.error("[GET /api/employees] Error:", err);
      res
        .status(500)
        .json({ message: "Failed to get employees", detail: err.message });
    }
  });

  app.post(
    "/api/employees",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const data = insertEmployeeSchema.parse(req.body);
        const employee = await scheduleService.createEmployee(data);
        res.status(201).json(employee);
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: err.errors });
        }
        console.error("[POST /api/employees] Error:", err);
        res
          .status(500)
          .json({ message: "Failed to create employee", detail: err.message });
      }
    }
  );

  app.patch(
    "/api/employees/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const data = updateEmployeeSchema.omit({ id: true }).parse(req.body);
        const employee = await scheduleService.updateEmployee(id, data);
        res.json(employee);
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: err.errors });
        }
        console.error("[PATCH /api/employees/:id] Error:", err);
        res
          .status(500)
          .json({ message: "Failed to update employee", detail: err.message });
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
      } catch (err: any) {
        console.error("[DELETE /api/employees/:id] Error:", err);
        res
          .status(500)
          .json({ message: "Failed to delete employee", detail: err.message });
      }
    }
  );

  /* =====================================================
   * HOLIDAYS
   * ===================================================*/
  app.get("/api/holidays", async (_req, res) => {
    try {
      const holidays = await scheduleService.getAllHolidays();
      res.json(holidays);
    } catch (err: any) {
      console.error("[GET /api/holidays] Error:", err);
      res
        .status(500)
        .json({ message: "Failed to get holidays", detail: err.message });
    }
  });

  app.post(
    "/api/holidays",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const data = insertHolidaySchema.parse(req.body);
        const holiday = await scheduleService.createHoliday(data);
        res.status(201).json(holiday);
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: err.errors });
        }
        console.error("[POST /api/holidays] Error:", err);
        res
          .status(500)
          .json({ message: "Failed to create holiday", detail: err.message });
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
      } catch (err: any) {
        console.error("[DELETE /api/holidays/:id] Error:", err);
        res
          .status(500)
          .json({ message: "Failed to delete holiday", detail: err.message });
      }
    }
  );

  /* =====================================================
   * VACATIONS
   * ===================================================*/
  app.get("/api/vacations", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string);
      const employeeId = req.query.employeeId as string | undefined;
      if (isNaN(year)) {
        return res
          .status(400)
          .json({ message: "Year parameter is required and must be a number" });
      }
      const vacations = await vacationService.list(year, employeeId);
      res.json(vacations);
    } catch (err: any) {
      console.error("[GET /api/vacations] Error:", err);
      res
        .status(500)
        .json({ message: "Failed to get vacations", detail: err.message });
    }
  });

  app.post(
    "/api/vacations",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const data = insertVacationSchema.parse(req.body);
        const employees = await scheduleService.getAllEmployees();
        const employee = employees.find((e) => e.id === data.employeeId);
        if (!employee) {
          return res
            .status(400)
            .json({ message: "Funcionário não encontrado" });
        }
        const vacation = await vacationService.create(data, employee.name);
        res.status(201).json(vacation);
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: err.errors });
        }
        const status = err.message.includes("conflita")
          ? 409
          : err.message.includes("atravessar")
          ? 400
          : 500;
        console.error("[POST /api/vacations] Error:", err);
        res
          .status(status)
          .json({ message: "Failed to create vacation", detail: err.message });
      }
    }
  );

  app.patch(
    "/api/vacations/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const data = updateVacationSchema.parse(req.body);
        const vacation = await vacationService.update(id, data);
        res.json(vacation);
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: err.errors });
        }
        const status = err.message.includes("conflita")
          ? 409
          : err.message.includes("atravessar")
          ? 400
          : err.message.includes("não encontrado")
          ? 404
          : 500;
        console.error("[PATCH /api/vacations/:id] Error:", err);
        res
          .status(status)
          .json({ message: "Failed to update vacation", detail: err.message });
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
      } catch (err: any) {
        const status = err.message.includes("não encontrado") ? 404 : 500;
        console.error("[DELETE /api/vacations/:id] Error:", err);
        res
          .status(status)
          .json({ message: "Failed to delete vacation", detail: err.message });
      }
    }
  );

  /* =====================================================
   * SCHEDULE (GET + GENERATE + WEEKENDS + UPDATE DAY)
   * ===================================================*/

  // Retorna apenas array de days (ScheduleEntry[])
  app.get("/api/schedule/:year/:month", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      const forceRegenerate = req.query.forceRegenerate === "true";

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: "Invalid year or month" });
      }

      const ifNoneMatch = req.headers["if-none-match"] as string | undefined;

      try {
        const result = await scheduleService.getScheduleForMonth(
          year,
          month,
          ifNoneMatch,
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
    } catch (err: any) {
      console.error("[GET /api/schedule/:year/:month] Error:", err);
      res
        .status(500)
        .json({ message: "Failed to get schedule", detail: err.message });
    }
  });

  // Gera / recria toda a escala mensal (dias úteis + limpa finais de semana)
  app.post(
    "/api/schedule/generate",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { year, month } = generateMonthlyScheduleSchema.parse(req.body);
        const monthly = await scheduleService.generateMonthlySchedule(
          year,
          month
        );
        // persiste substituindo o doc anterior
        const docId = `schedule-${year}-${String(month).padStart(2, "0")}`;
        await (scheduleService as any).schedulesCollection
          .doc(docId)
          .set(monthly);
        // invalida cache
        (scheduleService as any).scheduleCache?.delete?.(docId); // caso queira acessar internamente
        res.status(201).json(monthly.days);
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: err.errors });
        }
        console.error("[POST /api/schedule/generate] Error:", err);
        res
          .status(500)
          .json({
            message: "Failed to generate schedule",
            detail: err.message,
          });
      }
    }
  );

  // Gera somente finais de semana (rotação)
  app.post(
    "/api/schedule/generate-weekends",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { year, month } = generateMonthlyScheduleSchema.parse(req.body);
        const result = await scheduleService.generateWeekendSchedule(
          year,
          month
        );
        res.status(201).json(result);
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: err.errors });
        }
        console.error("[POST /api/schedule/generate-weekends] Error:", err);
        res
          .status(500)
          .json({
            message: "Failed to generate weekend schedule",
            detail: err.message,
          });
      }
    }
  );

  // Atualiza assignments de um dia
  app.patch(
    "/api/schedule/day/:date",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { date } = req.params;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res
            .status(400)
            .json({ message: "Invalid date format (YYYY-MM-DD expected)" });
        }
        const validated = z
          .array(insertAssignmentSchema)
          .parse(req.body.assignments);
        const withIds = validated.map((a) => ({
          ...a,
          id: `${a.employeeId}-${date}`,
        }));
        const day = await scheduleService.updateDaySchedule(date, withIds);
        res.json(day);
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", errors: err.errors });
        }
        console.error("[PATCH /api/schedule/day/:date] Error:", err);
        res
          .status(500)
          .json({
            message: "Failed to update day schedule",
            detail: err.message,
          });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}
