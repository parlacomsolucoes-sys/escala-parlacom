// src/pages/SchedulePage.tsx
import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  useSchedule,
  useHolidays,
  useGenerateMonthlySchedule,
} from "@/hooks/useSchedule";
import { useVacations } from "@/hooks/useVacations";
import { useToast } from "@/hooks/use-toast";
import DayEditModal from "@/components/modals/DayEditModal";
import {
  isWeekend as utilIsWeekend,
  isHoliday as utilIsHoliday,
} from "@shared/schema";
import { formatDateKey, getCurrentDateKey } from "@shared/utils/date";

interface CalendarDay {
  date: Date;
  dateString: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  holiday: any;
  assignments: any[];
}

export default function SchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [selectedDay, setSelectedDay] = useState<{
    date: string;
    assignments: any[];
  } | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Escala mensal
  const {
    data: scheduleEntries = [],
    isLoading: scheduleLoading,
    isFetching: scheduleFetching,
    error: scheduleError,
  } = useSchedule(year, month);

  // Feriados recorrentes
  const { data: holidays = [], isLoading: holidaysLoading } = useHolidays();

  // Períodos de férias
  const { data: vacations = [] } = useVacations(year);

  // Geração de escala
  const generateSchedule = useGenerateMonthlySchedule();

  const formatMonthYear = (date: Date) =>
    date.toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "long",
    });

  /* ================= Próximos Finais de Semana ================= */
  const nextWeekends = useMemo(() => {
    const today = new Date();
    const future: Array<{ date: Date; assignments: any[] }> = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() === 6 || d.getDay() === 0) {
        const key = formatDateKey(d);
        const entry = scheduleEntries.find((e: any) => e.date === key);
        if (d >= today) {
          future.push({
            date: d,
            assignments: entry?.assignments || [],
          });
        }
      }
    }
    return future.slice(0, 4);
  }, [scheduleEntries]);

  /* ================= Próximos Feriados ================= */
  const nextHolidays = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const arr: Array<{ name: string; date: Date }> = [];

    holidays.forEach((h: any) => {
      if (!h.date) return;
      const [m, d] = h.date.split("-").map(Number);
      let holidayDate = new Date(currentYear, m - 1, d);
      if (holidayDate >= today) {
        arr.push({ name: h.name, date: holidayDate });
      } else {
        holidayDate = new Date(currentYear + 1, m - 1, d);
        arr.push({ name: h.name, date: holidayDate });
      }
    });

    return arr.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3);
  }, [holidays]);

  /* ================= Próximas Férias dos Funcionários ================= */
  const nextVacations = useMemo(() => {
    const today = new Date();
    // ordenar por data de início mais próxima
    return vacations
      .map((v) => ({
        ...v,
        start: new Date(v.startDate),
      }))
      .filter((v) => v.start >= today)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 3);
  }, [vacations]);

  /* ================= Navegação de Mês ================= */
  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + (direction === "prev" ? -1 : 1));
      return next;
    });
  };

  /* ================= Calendar (Month View) ================= */
  const calendarDays: CalendarDay[] = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    const days: CalendarDay[] = [];
    const iter = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const dateString = formatDateKey(iter);
      const entry = scheduleEntries.find((e: any) => e.date === dateString);
      const isCurrentMonth = iter.getMonth() === month - 1;
      const isToday = iter.toDateString() === new Date().toDateString();
      const holiday = utilIsHoliday(iter, holidays);

      days.push({
        date: new Date(iter),
        dateString,
        day: iter.getDate(),
        isCurrentMonth,
        isToday,
        isWeekend: utilIsWeekend(iter),
        holiday,
        assignments: entry?.assignments || [],
      });

      iter.setDate(iter.getDate() + 1);
    }
    return days;
  }, [year, month, scheduleEntries, holidays]);

  /* ================= Week View ================= */
  const weekDays: CalendarDay[] = useMemo(() => {
    const startOfWeek = new Date(selectedWeekStart);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const result: CalendarDay[] = [];
    const iter = new Date(startOfWeek);

    for (let i = 0; i < 7; i++) {
      const dateString = formatDateKey(iter);
      const entry = scheduleEntries.find((e: any) => e.date === dateString);
      const isToday = iter.toDateString() === new Date().toDateString();
      const holiday = utilIsHoliday(iter, holidays);

      result.push({
        date: new Date(iter),
        dateString,
        day: iter.getDate(),
        isCurrentMonth: iter.getMonth() === month - 1,
        isToday,
        isWeekend: utilIsWeekend(iter),
        holiday,
        assignments: entry?.assignments || [],
      });

      iter.setDate(iter.getDate() + 1);
    }
    return result;
  }, [selectedWeekStart, scheduleEntries, holidays, month]);

  /* ================= Day View ================= */
  const dayData = useMemo(() => {
    let targetDate: Date;
    let dateString: string;

    if (!selectedDay) {
      targetDate = new Date();
      dateString = formatDateKey(targetDate);
    } else {
      dateString = selectedDay.date;
      targetDate = new Date(selectedDay.date);
    }
    const entry = scheduleEntries.find((e: any) => e.date === dateString);
    const holiday = utilIsHoliday(targetDate, holidays);

    return {
      date: targetDate,
      dateString,
      day: targetDate.getDate(),
      isToday: targetDate.toDateString() === new Date().toDateString(),
      isWeekend: utilIsWeekend(targetDate),
      holiday,
      assignments: entry?.assignments || [],
    };
  }, [selectedDay, scheduleEntries, holidays]);

  /* ================= Handlers ================= */
  const handleDayClick = (day: CalendarDay) => {
    setSelectedDay({
      date: day.dateString,
      assignments: day.assignments,
    });
  };

  const navigateWeek = (direction: "prev" | "next") => {
    setSelectedWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + (direction === "prev" ? -7 : 7));
      return next;
    });
  };

  const handleGenerateSchedule = async () => {
    if (!user) return;
    try {
      await generateSchedule.mutateAsync({ year, month });
      toast({
        title: "Escala gerada",
        description: "Escala mensal foi gerada com sucesso",
      });
    } catch {
      toast({
        title: "Erro ao gerar escala",
        description: "Não foi possível gerar a escala mensal",
        variant: "destructive",
      });
    }
  };

  const getAssignmentColor = (index: number) => {
    const colors = [
      "bg-blue-100 text-blue-800",
      "bg-green-100 text-green-800",
      "bg-purple-100 text-purple-800",
      "bg-orange-100 text-orange-800",
      "bg-indigo-100 text-indigo-800",
    ];
    return colors[index % colors.length];
  };

  /* ================= Loading / Error states ================= */
  if (scheduleLoading || holidaysLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Loader2 className="animate-spin mb-4" size={32} />
        Carregando escala...
      </div>
    );
  }

  if (scheduleError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium mb-2">
          Erro ao carregar escala.
        </p>
        <p className="text-sm text-gray-500">
          Tente atualizar a página ou gerar novamente.
        </p>
      </div>
    );
  }

  /* ================= Render ================= */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Escala de Trabalho
          </h2>
          <p className="text-gray-600 mt-1">
            Visualize e gerencie a escala mensal dos funcionários
          </p>
          {scheduleFetching && (
            <span className="inline-flex items-center text-xs text-gray-400 mt-1">
              <Loader2 size={14} className="animate-spin mr-1" /> atualizando...
            </span>
          )}
        </div>

        {/* Controles de visão e geração */}
        <div className="flex items-center space-x-4">
          <div className="bg-white rounded-lg border border-gray-200 p-1 flex">
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className={viewMode === "month" ? "bg-brand text-white" : ""}
            >
              Mês
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className={viewMode === "week" ? "bg-brand text-white" : ""}
            >
              Semana
            </Button>
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("day")}
              className={viewMode === "day" ? "bg-brand text-white" : ""}
            >
              Dia
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth("prev")}
              className="p-2"
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-lg font-semibold text-gray-900 min-w-[150px] text-center">
              {formatMonthYear(currentDate)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth("next")}
              className="p-2"
            >
              <ChevronRight size={16} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                setCurrentDate(today);
                setSelectedWeekStart(today);
                setViewMode("day");
                setSelectedDay({
                  date: getCurrentDateKey(),
                  assignments: [],
                });
              }}
              className="px-3"
            >
              Hoje
            </Button>
          </div>
          {user && (
            <Button
              onClick={handleGenerateSchedule}
              disabled={generateSchedule.isPending}
              className="bg-brand hover:bg-brand-dark text-white"
            >
              <Calendar className="mr-2" size={16} />
              {generateSchedule.isPending ? "Gerando..." : "Gerar Escala"}
            </Button>
          )}
        </div>
      </div>

      {/* Painéis Laterais: 3 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Próximos Finais de Semana */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="mr-2 text-brand" size={20} />
            Próximos Finais de Semana
          </h3>
          {nextWeekends.length === 0 ? (
            <p className="text-gray-500">
              Nenhum final de semana encontrado nos próximos dias
            </p>
          ) : (
            <div className="space-y-3">
              {nextWeekends.slice(0, 2).map((w, i) => (
                <div
                  key={i}
                  className="border-l-4 border-l-brand pl-4 py-2 bg-gray-50/40 rounded"
                >
                  <div className="font-medium text-gray-900">
                    {w.date.toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                  {w.assignments.length === 0 ? (
                    <div className="text-sm text-red-500">⚠️ Não gerado</div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      {w.assignments.map((a) => a.employeeName).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Próximos Feriados */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="mr-2 text-brand" size={20} />
            Próximos Feriados
          </h3>
          {nextHolidays.length === 0 ? (
            <p className="text-gray-500">Nenhum feriado cadastrado</p>
          ) : (
            <div className="space-y-3">
              {nextHolidays.map((h, i) => (
                <div
                  key={i}
                  className="border-l-4 border-l-orange-400 pl-4 py-2 bg-orange-50/40 rounded"
                >
                  <div className="font-medium text-gray-900">{h.name}</div>
                  <div className="text-sm text-gray-600">
                    {h.date.toLocaleDateString("pt-BR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Próximas Férias dos Funcionários */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Info className="mr-2 text-brand" size={20} />
            Férias dos Funcionários
          </h3>
          {nextVacations.length === 0 ? (
            <p className="text-gray-500">Nenhuma férias futura cadastrada</p>
          ) : (
            <div className="space-y-3">
              {nextVacations.map((v, i) => (
                <div
                  key={i}
                  className="border-l-4 border-l-blue-400 pl-4 py-2 bg-blue-50/40 rounded"
                >
                  <div className="font-medium text-gray-900">
                    {v.employeeName}
                  </div>
                  <div className="text-sm text-gray-600">
                    {new Date(v.startDate).toLocaleDateString("pt-BR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    –{" "}
                    {new Date(v.endDate).toLocaleDateString("pt-BR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== Month View ===== */}
      {viewMode === "month" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Cabeçalho das Semanas */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div
                key={d}
                className="px-4 py-3 text-center text-sm font-semibold text-gray-700"
              >
                {d}
              </div>
            ))}
          </div>
          {/* Dias do Mês */}
          <div className="grid grid-cols-7 divide-x divide-gray-200">
            {calendarDays.map((day, idx) => {
              const baseClass =
                "h-32 p-2 cursor-pointer transition-colors border-b border-gray-100 relative";
              const visualClass = !day.isCurrentMonth
                ? "bg-gray-50/50 text-gray-400"
                : day.isToday
                ? "border-l-4 border-l-brand bg-brand/5"
                : day.isWeekend
                ? "bg-gray-50/80"
                : day.holiday
                ? "bg-brand/20"
                : "hover:bg-gray-50";

              return (
                <div
                  key={idx}
                  className={`${baseClass} ${visualClass}`}
                  onClick={() => handleDayClick(day)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span
                      className={`text-sm font-medium ${
                        day.isToday
                          ? "text-brand font-bold"
                          : !day.isCurrentMonth
                          ? "text-gray-400"
                          : day.isWeekend
                          ? "text-gray-700"
                          : "text-gray-900"
                      }`}
                    >
                      {day.day}
                    </span>
                    {day.isToday && (
                      <span className="text-xs text-brand font-medium">
                        Hoje
                      </span>
                    )}
                    {day.holiday && (
                      <Calendar className="text-brand" size={12} />
                    )}
                  </div>
                  {day.holiday && (
                    <div className="text-[10px] text-brand font-medium mb-1 line-clamp-2">
                      {day.holiday.name}
                    </div>
                  )}
                  <div className="space-y-1">
                    {day.assignments.slice(0, 2).map((a, i) => (
                      <div
                        key={a.id}
                        className={`text-[10px] px-1.5 py-1 rounded truncate ${getAssignmentColor(
                          i
                        )}`}
                        title={`${a.employeeName} ${a.startTime}-${a.endTime}`}
                      >
                        {a.employeeName} {a.startTime}-{a.endTime}
                      </div>
                    ))}
                    {day.assignments.length > 2 && (
                      <div className="text-[10px] text-gray-500 px-1">
                        +{day.assignments.length - 2} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Week View ===== */}
      {viewMode === "week" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Semana de {weekDays[0]?.day}/{month} - {weekDays[6]?.day}/{month}
            </h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateWeek("prev")}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateWeek("next")}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 divide-x divide-gray-200">
            {weekDays.map((day, index) => {
              const cls = day.isToday
                ? "border-l-4 border-l-brand bg-brand/5"
                : day.isWeekend
                ? "bg-gray-50/80"
                : day.holiday
                ? "bg-brand/20"
                : "hover:bg-gray-50";

              return (
                <div
                  key={index}
                  className={`p-4 min-h-[200px] cursor-pointer transition-colors ${cls}`}
                  onClick={() => handleDayClick(day)}
                >
                  <div className="text-center mb-3">
                    <div className="text-xs text-gray-500">
                      {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][index]}
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        day.isToday ? "text-brand font-bold" : "text-gray-900"
                      }`}
                    >
                      {day.day}
                    </div>
                    {day.holiday && (
                      <div className="text-[10px] text-brand font-medium mt-1">
                        {day.holiday.name}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {day.assignments.map((a, i) => (
                      <div
                        key={a.id}
                        className={`text-xs px-2 py-1 rounded ${getAssignmentColor(
                          i
                        )}`}
                      >
                        <div className="font-medium">{a.employeeName}</div>
                        <div>
                          {a.startTime}-{a.endTime}
                        </div>
                      </div>
                    ))}
                    {day.assignments.length === 0 && (
                      <div className="text-[11px] text-gray-400 italic">
                        sem escala
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Day View ===== */}
      {viewMode === "day" && dayData && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {dayData.date.toLocaleDateString("pt-BR", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              {dayData.holiday && (
                <div className="text-brand font-medium mt-1">
                  🎄 Feriado: {dayData.holiday.name}
                </div>
              )}
            </div>
            <Button variant="outline" onClick={() => setViewMode("month")}>
              Voltar ao Mês
            </Button>
          </div>
          <div className="p-6">
            {dayData.assignments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="mx-auto mb-4 text-gray-300" size={48} />
                <p>Nenhum funcionário escalado para este dia</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 mb-4">
                  Funcionários Escalados ({dayData.assignments.length})
                </h4>
                {dayData.assignments
                  .slice()
                  .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
                  .map((a, i) => (
                    <div
                      key={a.id}
                      className={`p-4 rounded-lg border ${
                        dayData.isWeekend
                          ? "border-orange-200 bg-orange-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            {a.employeeName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {a.startTime} - {a.endTime}
                          </div>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getAssignmentColor(
                            i
                          )}`}
                        >
                          {dayData.isWeekend ? "Fim de Semana" : "Dia Útil"}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {selectedDay && viewMode !== "day" && (
        <DayEditModal
          isOpen={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          date={selectedDay.date}
          assignments={selectedDay.assignments}
        />
      )}
    </div>
  );
}
