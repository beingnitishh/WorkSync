import { NextRequest, NextResponse } from "next/server";
import { db, ensureDatabase } from "@/lib/db";
import {
  FirstSundayPattern,
  SalaryCalculationMethod,
  calculateSalaryForRange,
  calculateMonthSalary,
  parseDate,
  formatDate,
  isValidDateString,
} from "@/lib/attendance";

// GET /api/salary?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
// GET /api/salary?month=1&year=2025
export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const fromDateStr = searchParams.get("fromDate");
    const toDateStr = searchParams.get("toDate");
    const monthStr = searchParams.get("month");
    const yearStr = searchParams.get("year");

    // Get employee
    const employee = await db.employee.findFirst();
    if (!employee) {
      return NextResponse.json(
        { error: "No employee profile found" },
        { status: 404 }
      );
    }

    const firstSundayPattern = employee.firstSundayPattern as FirstSundayPattern;
    const salaryCalculationMethod = employee.salaryCalculationMethod as SalaryCalculationMethod;

    // Monthly calculation
    if (monthStr && yearStr) {
      const month = parseInt(monthStr, 10);
      const year = parseInt(yearStr, 10);

      if (isNaN(month) || month < 1 || month > 12) {
        return NextResponse.json(
          { error: "Month must be between 1 and 12" },
          { status: 400 }
        );
      }

      if (isNaN(year) || year < 1900 || year > 2100) {
        return NextResponse.json(
          { error: "Year must be a valid year" },
          { status: 400 }
        );
      }

      // Get attendance records for the month
      const fromStr = `${year}-${String(month).padStart(2, "0")}-01`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const toStr = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

      const attendanceRecords = await db.attendance.findMany({
        where: {
          employeeId: employee.id,
          date: { gte: fromStr, lte: toStr },
        },
        orderBy: { date: "asc" },
      });

      const mappedRecords = attendanceRecords.map((r) => ({
        date: r.date,
        status: r.status,
        payableValue: r.payableValue,
        isManualOverride: r.isManualOverride,
      }));

      const result = calculateMonthSalary(
        year,
        month,
        employee.monthlySalary,
        salaryCalculationMethod,
        firstSundayPattern,
        mappedRecords
      );

      return NextResponse.json({
        employee: {
          id: employee.id,
          name: employee.name,
          monthlySalary: employee.monthlySalary,
          salaryCalculationMethod: employee.salaryCalculationMethod,
        },
        salary: result,
      });
    }

    // Date range calculation
    if (fromDateStr && toDateStr) {
      if (!isValidDateString(fromDateStr) || !isValidDateString(toDateStr)) {
        return NextResponse.json(
          { error: "Valid fromDate and toDate (YYYY-MM-DD) are required" },
          { status: 400 }
        );
      }

      const fromDate = parseDate(fromDateStr);
      const toDate = parseDate(toDateStr);

      if (fromDate > toDate) {
        return NextResponse.json(
          { error: "'fromDate' must be before or equal to 'toDate'" },
          { status: 400 }
        );
      }

      const attendanceRecords = await db.attendance.findMany({
        where: {
          employeeId: employee.id,
          date: { gte: fromDateStr, lte: toDateStr },
        },
        orderBy: { date: "asc" },
      });

      const mappedRecords = attendanceRecords.map((r) => ({
        date: r.date,
        status: r.status,
        payableValue: r.payableValue,
        isManualOverride: r.isManualOverride,
      }));

      const result = calculateSalaryForRange(
        fromDate,
        toDate,
        employee.monthlySalary,
        salaryCalculationMethod,
        firstSundayPattern,
        mappedRecords
      );

      return NextResponse.json({
        employee: {
          id: employee.id,
          name: employee.name,
          monthlySalary: employee.monthlySalary,
          salaryCalculationMethod: employee.salaryCalculationMethod,
        },
        salary: result,
      });
    }

    return NextResponse.json(
      {
        error:
          "Provide either 'month' and 'year' parameters, or 'fromDate' and 'toDate' parameters",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error calculating salary:", error);
    return NextResponse.json(
      { error: "Failed to calculate salary" },
      { status: 500 }
    );
  }
}
