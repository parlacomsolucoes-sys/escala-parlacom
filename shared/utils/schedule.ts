import type { Holiday, Employee } from "@shared/schema";

// Check if a date is a weekend (Saturday=6 or Sunday=0)
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

// Format date to YYYY-MM-DD
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get all days in a month as Date objects
export function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const lastDay = new Date(year, month, 0).getDate();
  
  for (let day = 1; day <= lastDay; day++) {
    days.push(new Date(year, month - 1, day));
  }
  
  return days;
}

// Normalize holiday input to MM-DD format
export function normalizeHolidayInput(dateStr: string): string {
  if (dateStr.includes('-') && dateStr.length === 10) {
    // YYYY-MM-DD format, extract MM-DD
    return dateStr.substring(5);
  }
  // Already MM-DD format
  return dateStr;
}

// Create a holiday lookup map by MM-DD
export function calcHolidayMap(holidays: Holiday[]): Record<string, { id: string; name: string }> {
  const map: Record<string, { id: string; name: string }> = {};
  
  holidays.forEach(holiday => {
    const normalizedDate = normalizeHolidayInput(holiday.date);
    map[normalizedDate] = {
      id: holiday.id,
      name: holiday.name
    };
  });
  
  return map;
}

// Get employee's working times for a specific weekday
export function pickEmployeeDefaultTimes(employee: Employee, weekdayIndex: number): {
  startTime: string;
  endTime: string;
} {
  const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const weekdayName = weekdayNames[weekdayIndex];
  
  const customSchedule = employee.customSchedule?.[weekdayName];
  
  return {
    startTime: customSchedule?.startTime || employee.defaultStartTime,
    endTime: customSchedule?.endTime || employee.defaultEndTime
  };
}

// Check if a date is a holiday
export function isHolidayDate(date: Date, holidayMap: Record<string, { id: string; name: string }>): { id: string; name: string } | null {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const mmdd = `${month}-${day}`;
  
  return holidayMap[mmdd] || null;
}

// Generate simple hash for ETag using built-in methods
export function generateETag(data: any): string {
  const jsonString = JSON.stringify(data);
  // Simple hash function for ETag - good enough for caching
  let hash = 0;
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `"${Math.abs(hash).toString(36)}"`;
}

// Parse year-month from date string
export function parseYearMonth(date: string): { year: number; month: number } {
  const [year, month] = date.split('-').map(Number);
  return { year, month };
}

// Generate document ID for monthly schedule
export function getMonthlyScheduleId(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}