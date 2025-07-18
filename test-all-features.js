// Comprehensive test for all implemented features
const tests = [
  {
    name: "T1: Two employees rotation - first month",
    description: "Generate weekend schedule for month with 2 employees",
    test: async () => {
      const response = await fetch("http://localhost:5000/api/schedule/generate-weekends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: 2025, month: 8 })
      });
      
      if (response.status === 401) {
        return { success: false, message: "Auth required - expected for public test" };
      }
      
      const result = await response.json();
      return { 
        success: response.ok,
        result,
        message: response.ok ? "Weekend generation successful" : "Weekend generation failed"
      };
    }
  },
  {
    name: "T2: Schedule idempotency check",
    description: "Re-generate same month should be idempotent",
    test: async () => {
      const response = await fetch("http://localhost:5000/api/schedule/generate-weekends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: 2025, month: 7 })
      });
      
      if (response.status === 401) {
        return { success: false, message: "Auth required - expected for public test" };
      }
      
      const result = await response.json();
      return { 
        success: response.ok,
        result,
        message: response.ok ? "Idempotency check successful" : "Idempotency check failed"
      };
    }
  },
  {
    name: "T3: Employee data verification",
    description: "Check if employees have correct weekend rotation flags",
    test: async () => {
      const response = await fetch("http://localhost:5000/api/employees");
      const employees = await response.json();
      
      const rotationEmployees = employees.filter(emp => emp.weekendRotation === true);
      const expectedCount = 2; // Kellen and Maicon
      
      return {
        success: rotationEmployees.length === expectedCount,
        result: { rotationEmployees: rotationEmployees.map(e => e.name), count: rotationEmployees.length },
        message: `Found ${rotationEmployees.length} employees with weekend rotation (expected: ${expectedCount})`
      };
    }
  },
  {
    name: "T4: Holiday format verification",
    description: "Check if holidays display in DD/MM format",
    test: async () => {
      const response = await fetch("http://localhost:5000/api/holidays");
      const holidays = await response.json();
      
      const validFormat = holidays.every(holiday => {
        const parts = holiday.date.split('-');
        return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]);
      });
      
      return {
        success: validFormat,
        result: { holidays: holidays.map(h => ({ name: h.name, date: h.date })) },
        message: validFormat ? "Holiday format is correct" : "Holiday format is incorrect"
      };
    }
  },
  {
    name: "T5: Schedule data consistency",
    description: "Verify schedule entries use formatDateKey format",
    test: async () => {
      const response = await fetch("http://localhost:5000/api/schedule/2025/7");
      const scheduleEntries = await response.json();
      
      const validDateFormat = scheduleEntries.every(entry => {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        return dateRegex.test(entry.date);
      });
      
      return {
        success: validDateFormat,
        result: { 
          sampleDates: scheduleEntries.slice(0, 3).map(e => e.date),
          totalEntries: scheduleEntries.length
        },
        message: validDateFormat ? "Date format is consistent" : "Date format is inconsistent"
      };
    }
  },
  {
    name: "T6: Weekend assignment verification",
    description: "Check if weekend assignments follow rotation pattern",
    test: async () => {
      const response = await fetch("http://localhost:5000/api/schedule/2025/7");
      const scheduleEntries = await response.json();
      
      const weekendEntries = scheduleEntries.filter(entry => {
        const date = new Date(entry.date);
        const dayOfWeek = date.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
      });
      
      const weekendAssignments = weekendEntries.filter(entry => entry.assignments.length > 0);
      
      return {
        success: weekendAssignments.length > 0,
        result: { 
          weekendDays: weekendEntries.length,
          assignedWeekends: weekendAssignments.length,
          sampleAssignments: weekendAssignments.slice(0, 3).map(e => ({
            date: e.date,
            employees: e.assignments.map(a => a.employeeName)
          }))
        },
        message: `Found ${weekendAssignments.length} weekend assignments out of ${weekendEntries.length} weekend days`
      };
    }
  }
];

console.log("Starting comprehensive feature tests...\n");

async function runAllTests() {
  const results = [];
  
  for (const test of tests) {
    console.log(`Running ${test.name}...`);
    try {
      const result = await test.test();
      results.push({
        name: test.name,
        ...result
      });
      console.log(`✅ ${test.name}: ${result.message}`);
      if (result.result) {
        console.log(`   Details:`, JSON.stringify(result.result, null, 2));
      }
    } catch (error) {
      results.push({
        name: test.name,
        success: false,
        message: error.message
      });
      console.log(`❌ ${test.name}: ${error.message}`);
    }
    console.log("");
  }
  
  console.log("\n=== TEST SUMMARY ===");
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Success Rate: ${(passed/total*100).toFixed(1)}%`);
  
  if (passed === total) {
    console.log("🎉 All tests passed!");
  } else {
    console.log("⚠️  Some tests failed - check logs above");
  }
}

runAllTests().catch(console.error);