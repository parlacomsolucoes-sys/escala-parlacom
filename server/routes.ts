// server/routes.ts (trecho relevante de schedule)
app.get("/api/schedule/:year/:month", async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const forceRegenerate = req.query.forceRegenerate === "true";
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: "Invalid year or month" });
    }
    const etag = req.headers["if-none-match"];
    try {
      const result = await scheduleService.getScheduleForMonth(
        year,
        month,
        etag,
        forceRegenerate
      );
      res.set("ETag", result.etag);
      res.set("Cache-Control", "private, max-age=60");
      return res.json(result.schedule);
    } catch (e: any) {
      if (e.message === "NOT_MODIFIED") return res.status(304).send();
      throw e;
    }
  } catch (err: any) {
    console.error("Get schedule error:", err);
    res
      .status(500)
      .json({ message: "Failed to get schedule", detail: err.message });
  }
});

app.post(
  "/api/schedule/generate",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { year, month } = generateMonthlyScheduleSchema.parse(req.body);
      const days = await scheduleService.generateMonthlySchedule(year, month);
      res.status(201).json(days);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: err.errors });
      }
      console.error("Generate schedule error:", err);
      res
        .status(500)
        .json({ message: "Failed to generate schedule", detail: err.message });
    }
  }
);

app.post(
  "/api/schedule/generate-weekends",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { year, month } = req.body;
      if (!year || !month)
        return res.status(400).json({ message: "Invalid parameters" });
      const result = await scheduleService.generateWeekendSchedule(year, month);
      res.status(201).json(result);
    } catch (err: any) {
      console.error("Generate weekend schedule error:", err);
      res
        .status(500)
        .json({
          message: "Failed to generate weekend schedule",
          detail: err.message,
        });
    }
  }
);
