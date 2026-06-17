import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/holidays?year=2026 - List all holidays, optionally filter by year
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");

    const holidays = await db.holiday.findMany({
      orderBy: { date: "asc" },
    });

    // If year is specified, filter to include:
    // 1. Holidays with dates in that year
    // 2. Recurring holidays (show them with the requested year's date)
    if (year) {
      const yearPrefix = `${year}-`;
      const filtered = holidays.filter((h) => {
        if (h.date.startsWith(yearPrefix)) return true;
        if (h.recurring) {
          // For recurring holidays, include them mapped to the requested year
          return true;
        }
        return false;
      });

      // For recurring holidays not in this year, map to the requested year
      const mapped = filtered.map((h) => {
        if (h.recurring && !h.date.startsWith(yearPrefix)) {
          const monthDay = h.date.slice(5);
          return { ...h, date: `${year}-${monthDay}` };
        }
        return h;
      });

      return NextResponse.json({ holidays: mapped });
    }

    return NextResponse.json({ holidays });
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return NextResponse.json(
      { error: "Failed to fetch holidays" },
      { status: 500 }
    );
  }
}

// POST /api/holidays - Add a new holiday
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, name, recurring } = body;

    if (!date || !name) {
      return NextResponse.json(
        { error: "date and name are required" },
        { status: 400 }
      );
    }

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: "Date must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    // Check for duplicate date
    const existing = await db.holiday.findUnique({
      where: { date },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A holiday already exists for ${date}: ${existing.name}` },
        { status: 409 }
      );
    }

    const holiday = await db.holiday.create({
      data: {
        date,
        name: name.trim(),
        recurring: Boolean(recurring),
      },
    });

    return NextResponse.json({ holiday }, { status: 201 });
  } catch (error) {
    console.error("Error creating holiday:", error);
    return NextResponse.json(
      { error: "Failed to create holiday" },
      { status: 500 }
    );
  }
}
