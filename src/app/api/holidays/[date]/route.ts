import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE /api/holidays/[date] - Remove a holiday by date
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;

    const existing = await db.holiday.findUnique({
      where: { date },
    });

    if (!existing) {
      return NextResponse.json(
        { error: `No holiday found for date ${date}` },
        { status: 404 }
      );
    }

    await db.holiday.delete({
      where: { date },
    });

    return NextResponse.json({
      message: `Holiday "${existing.name}" on ${date} deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting holiday:", error);
    return NextResponse.json(
      { error: "Failed to delete holiday" },
      { status: 500 }
    );
  }
}
