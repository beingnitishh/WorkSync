import { NextRequest, NextResponse } from "next/server";
import { db, ensureDatabase } from "@/lib/db";
import {
  AttendanceStatus,
  getPayableValue,
  FirstSundayPattern,
  generateSundayPattern,
  formatDate,
  parseDate,
} from "@/lib/attendance";

// GET /api/attendance/stats?month=1&year=2025&employeeId=xxx
export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get("month");
    const yearStr = searchParams.get("year");
    const employeeId = searchParams.get("employeeId");

    if (!monthStr || !yearStr) {
      return NextResponse.json(
        { error: "month and year query parameters are required" },
        { status: 400 }
      );
    }

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

    // Get employee
    let employee;
    if (employeeId) {
      employee = await db.employee.findUnique({ where: { id: employeeId } });
    } else {
      employee = await db.employee.findFirst();
    }

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Get all attendance records for the month
    const fromStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const toStr = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const records = await db.attendance.findMany({
      where: {
        employeeId: employee.id,
        date: { gte: fromStr, lte: toStr },
      },
      orderBy: { date: "asc" },
    });

    // ─── 1. Current Streak (consecutive FULL_DAY from today backwards) ───
    const today = new Date();
    const todayStr = formatDate(today);
    let currentStreak = 0;

    // Get records from today backwards (including past days)
    const streakRecords = await db.attendance.findMany({
      where: {
        employeeId: employee.id,
        date: { lte: todayStr },
      },
      orderBy: { date: "desc" },
      take: 60, // Look back up to 60 days for streak
    });

    for (const record of streakRecords) {
      if (record.status === AttendanceStatus.FULL_DAY) {
        currentStreak++;
      } else {
        break;
      }
    }

    // ─── 2. Monthly Attendance Rate ───
    const daysWithRecords = records.length;
    const fullDays = records.filter((r) => r.status === AttendanceStatus.FULL_DAY).length;
    const halfDays = records.filter((r) => r.status === AttendanceStatus.HALF_DAY).length;
    const absentDays = records.filter((r) => r.status === AttendanceStatus.ABSENT).length;
    const offDays = records.filter((r) => r.status === AttendanceStatus.OFF).length;

    // Calculate working days (non-Sunday days) from the calendar
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month - 1, daysInMonth);
    const firstSundayPattern = employee.firstSundayPattern as FirstSundayPattern;
    const sundayPattern = generateSundayPattern(startOfMonth, endOfMonth, firstSundayPattern);
    const sundayDates = new Set(sundayPattern.map((s) => s.date));

    let workingDaysInMonth = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!sundayDates.has(dateStr)) {
        workingDaysInMonth++;
      }
    }

    // Attendance rate: (full days + 0.5 * half days) / working days
    const attendedDays = fullDays + halfDays * 0.5;
    const attendanceRate = workingDaysInMonth > 0
      ? Math.round((attendedDays / workingDaysInMonth) * 100 * 100) / 100
      : 0;

    // ─── 3. Most Common Absence Day ───
    const absenceByDayOfWeek: Record<number, number> = {};
    for (const record of records) {
      if (record.status === AttendanceStatus.ABSENT) {
        const d = parseDate(record.date);
        const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        absenceByDayOfWeek[dow] = (absenceByDayOfWeek[dow] || 0) + 1;
      }
    }

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let mostCommonAbsenceDay: string | null = null;
    let maxAbsenceCount = 0;
    for (const [dow, count] of Object.entries(absenceByDayOfWeek)) {
      if (count > maxAbsenceCount) {
        maxAbsenceCount = count;
        mostCommonAbsenceDay = dayNames[parseInt(dow, 10)];
      }
    }

    // ─── 4. Total Working Days vs Attended ───
    const totalPayableDays = records.reduce(
      (sum, r) => sum + (r.payableValue ?? getPayableValue(r.status as AttendanceStatus)),
      0
    );

    return NextResponse.json({
      employee: { id: employee.id, name: employee.name },
      month,
      year,
      currentStreak,
      attendanceRate,
      mostCommonAbsenceDay,
      mostCommonAbsenceCount: maxAbsenceCount,
      monthlyBreakdown: {
        totalCalendarDays: daysInMonth,
        workingDaysInMonth,
        totalDaysWithRecords: daysWithRecords,
        fullDays,
        halfDays,
        absentDays,
        offDays,
        totalPayableDays: Math.round(totalPayableDays * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Error fetching attendance stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance stats" },
      { status: 500 }
    );
  }
}
