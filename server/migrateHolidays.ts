import "dotenv/config";
import { storage } from "./storage";

async function migrateHolidays() {
  console.log("[MIGRATION] Iniciando migração de feriados para formato MM-DD...");
  
  try {
    // Get all holidays
    const holidays = await storage.getHolidays();
    console.log(`[MIGRATION] Encontrados ${holidays.length} feriados`);
    
    let migratedCount = 0;
    
    for (const holiday of holidays) {
      // Check if date is in old format (YYYY-MM-DD)
      if (holiday.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const monthDay = holiday.date.substring(5); // Extract MM-DD
        
        console.log(`[MIGRATION] Convertendo "${holiday.name}" de ${holiday.date} para ${monthDay}`);
        
        await storage.updateHoliday(holiday.id, {
          date: monthDay
        });
        
        migratedCount++;
      } else {
        console.log(`[MIGRATION] Feriado "${holiday.name}" já está no formato correto: ${holiday.date}`);
      }
    }
    
    console.log(`[MIGRATION] ✅ Migração concluída! ${migratedCount} feriados foram convertidos para formato MM-DD`);
    
  } catch (error) {
    console.error("[MIGRATION] ❌ Erro durante a migração:", error);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateHolidays();
}

export { migrateHolidays };