import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSchedule, useHolidays, useGenerateMonthlySchedule, useGenerateWeekendSchedule } from "@/hooks/useSchedule";
import { useToast } from "@/hooks/use-toast";
import DayEditModal from "@/components/modals/DayEditModal";
import type { ScheduleEntry, Holiday } from "@shared/schema";
import { isWeekend, isHoliday } from "@shared/schema";

export default function SchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [selectedDay, setSelectedDay] = useState<{ date: string; assignments: any[] } | null>(null);

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

  const getCalendarDays = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDay = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      const dateString = currentDay.toISOString().split('T')[0];
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

  const handleDayClick = (day: any) => {
    if (!day.isCurrentMonth) return;
    
    setSelectedDay({
      date: day.dateString,
      assignments: day.assignments
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

  const calendarDays = getCalendarDays();

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

      {/* Calendar Grid */}
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

      {/* Day Edit Modal */}
      {selectedDay && (
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
