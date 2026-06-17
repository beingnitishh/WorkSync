import { NextRequest, NextResponse } from "next/server";
import { db, ensureDatabase } from "@/lib/db";
import {
  FirstSundayPattern,
  AttendanceStatus,
  isValidDateString,
  parseDate,
  formatDate,
  generateAttendanceForRange,
  getPayableValue,
} from "@/lib/attendance";

// GET /api/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&employeeId=xxx
export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const employeeId = searchParams.get("employeeId");

    if (!from || !to || !isValidDateString(from) || !isValidDateString(to)) {
      return NextResponse.json(
        { error: "Valid 'from' and 'to' date parameters (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }

    const fromDate = parseDate(from);
    const toDate = parseDate(to);

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: "'from' date must be before or equal to 'to' date" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      date: { gte: from, lte: to },
    };
    if (employeeId) {
      where.employeeId = employeeId;
    }

    const records = await db.attendance.findMany({
      where,
      orderBy: { date: "asc" },
      include: { employee: { select: { name: true } } },
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance records" },
      { status: 500 }
    );
  }
}

// POST /api/attendance - Generate attendance for a date range
export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const { employeeId, from, to } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 }
      );
    }

    if (!from || !to || !isValidDateString(from) || !isValidDateString(to)) {
      return NextResponse.json(
        { error: "Valid 'from' and 'to' dates (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }

    const fromDate = parseDate(from);
    const toDate = parseDate(to);

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: "'from' date must be before or equal to 'to' date" },
        { status: 400 }
      );
    }

    // Get employee
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Ensure the from date is not before the employee's start date
    const employeeStart = parseDate(employee.startDate);
    const effectiveFrom = fromDate < employeeStart ? employeeStart : fromDate;
    const effectiveFromDateStr = formatDate(effectiveFrom);

    if (effectiveFrom > toDate) {
      return NextResponse.json(
        { error: "Date range is before employee's start date" },
        { status: 400 }
      );
    }

    // Generate attendance records based on pattern
    const firstSundayPattern = employee.firstSundayPattern as FirstSundayPattern;
    const generatedRecords = generateAttendanceForRange(
      effectiveFrom,
      toDate,
      firstSundayPattern
    );

    // Fetch holidays that fall within the range to auto-mark as OFF
    const holidays = await db.holiday.findMany({
      where: {
        date: { gte: effectiveFromDateStr, lte: to },
      },
    });
    const holidayDateSet = new Set<string>();
    for (const h of holidays) {
      holidayDateSet.add(h.date);
    }

    // Also check recurring holidays - they apply to any year
    const allHolidays = await db.holiday.findMany();
    for (const h of allHolidays) {
      if (h.recurring) {
        // Get the MM-DD part and check if it falls in the range
        const monthDay = h.date.slice(5);
        // Check each year in the range
        const startYear = effectiveFrom.getFullYear();
        const endYear = toDate.getFullYear();
        for (let y = startYear; y <= endYear; y++) {
          const candidateDate = `${y}-${monthDay}`;
          if (candidateDate >= effectiveFromDateStr && candidateDate <= to) {
            holidayDateSet.add(candidateDate);
          }
        }
      }
    }

    // Override holiday dates to OFF status (still paid as full day)
    const finalRecords = generatedRecords.map((record) => {
      if (holidayDateSet.has(record.date)) {
        return {
          ...record,
          status: AttendanceStatus.OFF,
          payableValue: getPayableValue(AttendanceStatus.OFF), // 1.0 — OFF is paid
        };
      }
      return record;
    });

    // Get existing records for the range to avoid duplicates
    const existingRecords = await db.attendance.findMany({
      where: {
        employeeId,
        date: { gte: effectiveFromDateStr, lte: to },
      },
    });
    const existingDates = new Set(existingRecords.map((r) => r.date));

    // Only create records that don't already exist
    const newRecords = finalRecords.filter(
      (r) => !existingDates.has(r.date)
    );

    // Create attendance records
    const created = await db.attendance.createMany({
      data: newRecords.map((record) => ({
        date: record.date,
        status: record.status,
        payableValue: record.payableValue,
        isAutoGenerated: true,
        isManualOverride: false,
        employeeId,
      })),
    });

    // Also return existing records for completeness
    const allRecords = await db.attendance.findMany({
      where: {
        employeeId,
        date: { gte: effectiveFromDateStr, lte: to },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({
      message: `Generated ${created.count} new attendance records`,
      createdCount: created.count,
      skippedCount: existingDates.size,
      records: allRecords,
    });
  } catch (error) {
    console.error("Error generating attendance:", error);
    return NextResponse.json(
      { error: "Failed to generate attendance records" },
      { status: 500 }
    );
  }
}
