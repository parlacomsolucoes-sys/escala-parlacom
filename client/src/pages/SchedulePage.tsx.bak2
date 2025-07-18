import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSchedule, useHolidays, useGenerateMonthlySchedule, useGenerateWeekendSchedule } from "@/hooks/useSchedule";
import { useToast } from "@/hooks/use-toast";
import DayEditModal from "@/components/modals/DayEditModal";
import type { ScheduleEntry, Holiday } from "@shared/schema";
import { isWeekend, isHoliday } from "@shared/schema";
import { formatDateKey, getCurrentDateKey } from "@shared/utils/date";

export default function SchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [selectedDay, setSelectedDay] = useState<{ date: string; assignments: any[] } | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: scheduleEntries = [], isLoading: scheduleLoading } = useSchedule(year, month);
  const { data: holidays = [] } = useHolidays();
  const generateSchedule = useGenerateMonthlySchedule();
  const generateWeekendSchedule = useGenerateWeekendSchedule();

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  // PHASE 4: Get next weekend information
  const getNextWeekendInfo = () => {
    const today = new Date();
    const futureWeekends: Array<{date: Date, assignments: any[]}> = [];
    
    // Check next 4 weeks for weekends
    for (let i = 0; i < 28; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      
      if (checkDate.getDay() === 6 || checkDate.getDay() === 0) { // Saturday or Sunday
        const dateString = checkDate.toISOString().split('T')[0];
        const scheduleEntry = scheduleEntries.find(entry => entry.date === dateString);
        
        if (checkDate >= today) {
          futureWeekends.push({
            date: checkDate,
            assignments: scheduleEntry?.assignments || []
          });
        }
      }
    }
    
    return futureWeekends.slice(0, 4); // Next 4 weekend days
  };

  // PHASE 4: Get next holidays information
  const getNextHolidaysInfo = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const nextHolidays: Array<{name: string, date: Date}> = [];
    
    holidays.forEach(holiday => {
      const [month, day] = holiday.date.split('-').map(Number);
      
      // Check this year's occurrence
      let holidayDate = new Date(currentYear, month - 1, day);
      if (holidayDate >= today) {
        nextHolidays.push({
          name: holiday.name,
          date: holidayDate
        });
      } else {
        // If passed this year, add next year's occurrence
        holidayDate = new Date(currentYear + 1, month - 1, day);
        nextHolidays.push({
          name: holiday.name,
          date: holidayDate
        });
      }
    });
    
    // Sort by date and take first 3
    return nextHolidays
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 3);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  // PHASE 3: Enhanced calendar data with view mode support
  const getCalendarDays = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDay = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      const dateString = formatDateKey(currentDay);
      const scheduleEntry = scheduleEntries.find(entry => entry.date === dateString);
      const isCurrentMonth = currentDay.getMonth() === month - 1;
      const isToday = currentDay.toDateString() === new Date().toDateString();
      const holiday = isHoliday(currentDay, holidays);
      
      days.push({
        date: new Date(currentDay),
        dateString,
        day: currentDay.getDate(),
        isCurrentMonth,
        isToday,
        isWeekend: isWeekend(currentDay),
        holiday,
        assignments: scheduleEntry?.assignments || []
      });
      
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    return days;
  };

  // PHASE 3: Get week view data
  const getWeekDays = () => {
    const startOfWeek = new Date(selectedWeekStart);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
    
    const days = [];
    const currentDay = new Date(startOfWeek);
    
    for (let i = 0; i < 7; i++) {
      const dateString = formatDateKey(currentDay);
      const scheduleEntry = scheduleEntries.find(entry => entry.date === dateString);
      const isToday = currentDay.toDateString() === new Date().toDateString();
      const holiday = isHoliday(currentDay, holidays);
      
      days.push({
        date: new Date(currentDay),
        dateString,
        day: currentDay.getDate(),
        isCurrentMonth: currentDay.getMonth() === month - 1,
        isToday,
        isWeekend: isWeekend(currentDay),
        holiday,
        assignments: scheduleEntry?.assignments || []
      });
      
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    return days;
  };

  // PHASE 3: Get single day data
  const getDayData = () => {
    if (!selectedDay) {
      // Default to today if no day selected
      const today = new Date();
      const todayString = formatDateKey(today);
      const scheduleEntry = scheduleEntries.find(entry => entry.date === todayString);
      const holiday = isHoliday(today, holidays);
      
      return {
        date: today,
        dateString: todayString,
        day: today.getDate(),
        isToday: true,
        isWeekend: isWeekend(today),
        holiday,
        assignments: scheduleEntry?.assignments || []
      };
    }
    
    const scheduleEntry = scheduleEntries.find(entry => entry.date === selectedDay.date);
    const dayDate = new Date(selectedDay.date);
    const holiday = isHoliday(dayDate, holidays);
    
    return {
      date: dayDate,
      dateString: selectedDay.date,
      day: dayDate.getDate(),
      isToday: dayDate.toDateString() === new Date().toDateString(),
      isWeekend: isWeekend(dayDate),
      holiday,
      assignments: scheduleEntry?.assignments || []
    };
  };

  // PHASE 3: Enhanced day click handler
  const handleDayClick = (day: any) => {
    setSelectedDay({
      date: day.dateString,
      assignments: day.assignments
    });
    
    // Auto-switch to day view when clicking a day
    if (viewMode !== "day") {
      setViewMode("day");
    }
  };

  // PHASE 3: Week navigation
  const navigateWeek = (direction: 'prev' | 'next') => {
    setSelectedWeekStart(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setDate(prev.getDate() - 7);
      } else {
        newDate.setDate(prev.getDate() + 7);
      }
      return newDate;
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
    } catch (error) {
      toast({
        title: "Erro ao gerar escala",
        description: "Não foi possível gerar a escala mensal",
        variant: "destructive",
      });
    }
  };

  // PHASE 5: Weekend schedule generation handler
  const handleGenerateWeekendSchedule = async () => {
    if (!user) return;
    
    try {
      const result = await generateWeekendSchedule.mutateAsync({ year, month });
      toast({
        title: "Escala de fins de semana gerada",
        description: `${result.daysGenerated} dias de fins de semana foram programados`,
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar escala de fins de semana",
        description: "Não foi possível gerar a escala de fins de semana",
        variant: "destructive",
      });
    }
  };

  // PHASE 3: Get data based on view mode
  const calendarDays = getCalendarDays();
  const weekDays = getWeekDays();
  const dayData = getDayData();
  
  // PHASE 4: Get upcoming info
  const nextWeekends = getNextWeekendInfo();
  const nextHolidays = getNextHolidaysInfo();

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

  return (
    <div className="space-y-6">
      {/* Page Header with View Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Escala de Trabalho</h2>
          <p className="text-gray-600 mt-1">Visualize e gerencie a escala mensal dos funcionários</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* View Mode Toggles */}
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
          
          {/* Month Navigation */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth('prev')}
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
              onClick={() => navigateMonth('next')}
              className="p-2"
            >
              <ChevronRight size={16} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentDate(new Date());
                setViewMode("day");
                setSelectedDay({ date: getCurrentDateKey(), assignments: [] });
              }}
              className="px-3"
            >
              Hoje
            </Button>
          </div>

          {/* Generate Schedule Buttons (Admin Only) */}
          {user && (
            <div className="flex space-x-2">
              <Button
                onClick={handleGenerateSchedule}
                disabled={generateSchedule.isPending}
                className="bg-brand hover:bg-brand-dark text-white"
              >
                <Calendar className="mr-2" size={16} />
                {generateSchedule.isPending ? "Gerando..." : "Gerar Escala"}
              </Button>
              {/* PHASE 5: Weekend schedule generation button */}
              <Button
                onClick={handleGenerateWeekendSchedule}
                disabled={generateWeekendSchedule.isPending}
                variant="outline"
                className="border-brand text-brand hover:bg-brand hover:text-white"
              >
                <Plus className="mr-2" size={16} />
                {generateWeekendSchedule.isPending ? "Gerando..." : "Fins de Semana"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* PHASE 4: Information Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Next Weekends Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="mr-2 text-brand" size={20} />
            Próximos Finais de Semana
          </h3>
          {nextWeekends.length === 0 ? (
            <p className="text-gray-500">Nenhum final de semana encontrado nos próximos dias</p>
          ) : (
            <div className="space-y-3">
              {nextWeekends.slice(0, 2).map((weekend, idx) => (
                <div key={idx} className="border-l-4 border-l-brand pl-4 py-2">
                  <div className="font-medium text-gray-900">
                    {weekend.date.toLocaleDateString('pt-BR', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'short' 
                    })}
                  </div>
                  {weekend.assignments.length === 0 ? (
                    <div className="text-sm text-red-500">
                      ⚠️ Não gerado
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      {weekend.assignments.map(a => a.employeeName).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Next Holidays Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="mr-2 text-brand" size={20} />
            Próximos Feriados
          </h3>
          {nextHolidays.length === 0 ? (
            <p className="text-gray-500">Nenhum feriado cadastrado</p>
          ) : (
            <div className="space-y-3">
              {nextHolidays.map((holiday, idx) => (
                <div key={idx} className="border-l-4 border-l-orange-400 pl-4 py-2">
                  <div className="font-medium text-gray-900">
                    {holiday.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {holiday.date.toLocaleDateString('pt-BR', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PHASE 3: Dynamic view rendering based on viewMode */}
      {viewMode === "month" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Calendar Header (Days of Week) */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
              <div key={day} className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                {day}
              </div>
            ))}
          </div>
        
        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 divide-x divide-gray-200">
          {calendarDays.map((day, index) => (
            <div
              key={index}
              className={`h-32 p-2 cursor-pointer transition-colors border-b border-gray-100 ${
                !day.isCurrentMonth 
                  ? "bg-gray-50/50 text-gray-400" 
                  : day.isToday
                  ? "border-l-4 border-l-brand bg-brand/5"
                  : day.isWeekend
                  ? "bg-gray-50/80"
                  : day.holiday
                  ? "bg-brand/20"
                  : "hover:bg-gray-50"
              }`}
              onClick={() => handleDayClick(day)}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-sm font-medium ${
                  day.isToday ? "text-brand font-bold" : 
                  !day.isCurrentMonth ? "text-gray-400" : 
                  day.isWeekend ? "text-gray-700" : "text-gray-900"
                }`}>
                  {day.day}
                </span>
                {day.isToday && (
                  <span className="text-xs text-brand font-medium">Hoje</span>
                )}
                {day.holiday && (
                  <Calendar className="text-brand" size={12} />
                )}
              </div>
              
              {day.holiday && (
                <div className="text-xs text-brand font-medium mb-1">
                  {day.holiday.name}
                </div>
              )}
              
              <div className="space-y-1">
                {day.assignments.slice(0, 2).map((assignment, idx) => (
                  <div
                    key={assignment.id}
                    className={`text-xs px-2 py-1 rounded truncate ${getAssignmentColor(idx)}`}
                  >
                    {assignment.employeeName} - {assignment.startTime}-{assignment.endTime}
                  </div>
                ))}
                {day.assignments.length > 2 && (
                  <div className="text-xs text-gray-500 px-1">
                    +{day.assignments.length - 2} mais
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        </div>
      )}

      {/* PHASE 3: Week View */}
      {viewMode === "week" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Semana de {weekDays[0]?.day}/{month} - {weekDays[6]?.day}/{month}
              </h3>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" onClick={() => navigateWeek('prev')}>
                  <ChevronLeft size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigateWeek('next')}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-7 divide-x divide-gray-200">
            {weekDays.map((day, index) => (
              <div
                key={index}
                className={`p-4 min-h-[200px] cursor-pointer transition-colors ${
                  day.isToday
                    ? "border-l-4 border-l-brand bg-brand/5"
                    : day.isWeekend
                    ? "bg-gray-50/80"
                    : day.holiday
                    ? "bg-brand/20"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => handleDayClick(day)}
              >
                <div className="text-center mb-3">
                  <div className="text-xs text-gray-500">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][index]}
                  </div>
                  <div className={`text-sm font-medium ${
                    day.isToday ? "text-brand font-bold" : "text-gray-900"
                  }`}>
                    {day.day}
                  </div>
                  {day.holiday && (
                    <div className="text-xs text-brand font-medium mt-1">
                      {day.holiday.name}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {day.assignments.map((assignment, idx) => (
                    <div
                      key={assignment.id}
                      className={`text-xs px-2 py-1 rounded ${getAssignmentColor(idx)}`}
                    >
                      <div className="font-medium">{assignment.employeeName}</div>
                      <div>{assignment.startTime}-{assignment.endTime}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PHASE 3: Day View */}
      {viewMode === "day" && dayData && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {dayData.date.toLocaleDateString('pt-BR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h3>
                {dayData.holiday && (
                  <div className="text-brand font-medium mt-1">
                    🎄 Feriado: {dayData.holiday.name}
                  </div>
                )}
              </div>
              <Button 
                variant="outline" 
                onClick={() => setViewMode("month")}
              >
                Voltar ao Mês
              </Button>
            </div>
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
                  .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
                  .map((assignment, idx) => (
                  <div
                    key={assignment.id}
                    className={`p-4 rounded-lg border ${
                      dayData.isWeekend ? "border-orange-200 bg-orange-50" : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {assignment.employeeName}
                        </div>
                        <div className="text-sm text-gray-600">
                          {assignment.startTime} - {assignment.endTime}
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${getAssignmentColor(idx)}`}>
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

      {/* Day Edit Modal */}
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
