import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  FirstSundayPattern,
  SalaryCalculationMethod,
  isValidDateString,
} from "@/lib/attendance";

// GET /api/profile - Get the employee profile (there should only be one)
export async function GET() {
  try {
    const employee = await db.employee.findFirst({
      include: { attendance: false },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "No employee profile found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ employee });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee profile" },
      { status: 500 }
    );
  }
}

// POST /api/profile - Create employee profile with validation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, startDate, monthlySalary, firstSundayPattern, salaryCalculationMethod } = body;

    // Validation
    const errors: string[] = [];

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      errors.push("Name is required and must be a non-empty string");
    }

    if (!startDate || typeof startDate !== "string" || !isValidDateString(startDate)) {
      errors.push("Start date is required and must be in YYYY-MM-DD format");
    }

    if (
      monthlySalary === undefined ||
      typeof monthlySalary !== "number" ||
      monthlySalary < 0
    ) {
      errors.push("Monthly salary is required and must be a non-negative number");
    }

    if (
      !firstSundayPattern ||
      !Object.values(FirstSundayPattern).includes(firstSundayPattern)
    ) {
      errors.push(
        `First Sunday pattern must be one of: ${Object.values(FirstSundayPattern).join(", ")}`
      );
    }

    if (
      !salaryCalculationMethod ||
      !Object.values(SalaryCalculationMethod).includes(salaryCalculationMethod)
    ) {
      errors.push(
        `Salary calculation method must be one of: ${Object.values(SalaryCalculationMethod).join(", ")}`
      );
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Use upsert: if a profile already exists, update it; otherwise create new
    const existing = await db.employee.findFirst();

    let employee;
    if (existing) {
      // Update existing profile
      employee = await db.employee.update({
        where: { id: existing.id },
        data: {
          name: name.trim(),
          startDate,
          monthlySalary,
          firstSundayPattern,
          salaryCalculationMethod,
        },
      });
      return NextResponse.json({ employee, updated: true });
    } else {
      // Create new profile
      employee = await db.employee.create({
        data: {
          name: name.trim(),
          startDate,
          monthlySalary,
          firstSundayPattern,
          salaryCalculationMethod,
        },
      });
      return NextResponse.json({ employee, created: true }, { status: 201 });
    }
  } catch (error) {
    console.error("Error creating profile:", error);
    return NextResponse.json(
      { error: "Failed to create employee profile" },
      { status: 500 }
    );
  }
}

// PUT /api/profile - Update employee profile
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, startDate, monthlySalary, firstSundayPattern, salaryCalculationMethod } = body;

    const existing = await db.employee.findFirst();
    if (!existing) {
      return NextResponse.json(
        { error: "No employee profile found. Use POST to create one." },
        { status: 404 }
      );
    }

    // Validation for provided fields
    const errors: string[] = [];

    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      errors.push("Name must be a non-empty string");
    }

    if (startDate !== undefined && (typeof startDate !== "string" || !isValidDateString(startDate))) {
      errors.push("Start date must be in YYYY-MM-DD format");
    }

    if (
      monthlySalary !== undefined &&
      (typeof monthlySalary !== "number" || monthlySalary < 0)
    ) {
      errors.push("Monthly salary must be a non-negative number");
    }

    if (
      firstSundayPattern !== undefined &&
      !Object.values(FirstSundayPattern).includes(firstSundayPattern)
    ) {
      errors.push(
        `First Sunday pattern must be one of: ${Object.values(FirstSundayPattern).join(", ")}`
      );
    }

    if (
      salaryCalculationMethod !== undefined &&
      !Object.values(SalaryCalculationMethod).includes(salaryCalculationMethod)
    ) {
      errors.push(
        `Salary calculation method must be one of: ${Object.values(SalaryCalculationMethod).join(", ")}`
      );
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (startDate !== undefined) updateData.startDate = startDate;
    if (monthlySalary !== undefined) updateData.monthlySalary = monthlySalary;
    if (firstSundayPattern !== undefined) updateData.firstSundayPattern = firstSundayPattern;
    if (salaryCalculationMethod !== undefined) updateData.salaryCalculationMethod = salaryCalculationMethod;

    const employee = await db.employee.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json({ employee });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update employee profile" },
      { status: 500 }
    );
  }
}

// DELETE /api/profile - Delete employee profile and all associated data
export async function DELETE() {
  try {
    const existing = await db.employee.findFirst();
    if (!existing) {
      return NextResponse.json(
        { error: "No employee profile found" },
        { status: 404 }
      );
    }

    // Delete all attendance records first (due to foreign key constraint)
    await db.attendance.deleteMany({
      where: { employeeId: existing.id },
    });

    // Delete the employee profile
    await db.employee.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({
      message: "Employee profile and all associated data deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting profile:", error);
    return NextResponse.json(
      { error: "Failed to delete employee profile" },
      { status: 500 }
    );
  }
}
