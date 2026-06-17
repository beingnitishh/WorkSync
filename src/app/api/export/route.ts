import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  FirstSundayPattern,
  SalaryCalculationMethod,
  calculateSalaryForRange,
  isValidDateString,
  parseDate,
} from "@/lib/attendance";

// GET /api/export?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&format=csv|pdf
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDateStr = searchParams.get("fromDate");
    const toDateStr = searchParams.get("toDate");
    const format = searchParams.get("format") || "csv";

    if (!fromDateStr || !toDateStr || !isValidDateString(fromDateStr) || !isValidDateString(toDateStr)) {
      return NextResponse.json(
        { error: "Valid fromDate and toDate (YYYY-MM-DD) parameters are required" },
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

    // Get employee
    const employee = await db.employee.findFirst();
    if (!employee) {
      return NextResponse.json(
        { error: "No employee profile found" },
        { status: 404 }
      );
    }

    // Get attendance records
    const attendanceRecords = await db.attendance.findMany({
      where: {
        employeeId: employee.id,
        date: { gte: fromDateStr, lte: toDateStr },
      },
      orderBy: { date: "asc" },
    });

    const firstSundayPattern = employee.firstSundayPattern as FirstSundayPattern;
    const salaryCalculationMethod = employee.salaryCalculationMethod as SalaryCalculationMethod;

    // Calculate salary for the period
    const mappedRecords = attendanceRecords.map((r) => ({
      date: r.date,
      status: r.status,
      payableValue: r.payableValue,
      isManualOverride: r.isManualOverride,
    }));

    const salaryResult = calculateSalaryForRange(
      fromDate,
      toDate,
      employee.monthlySalary,
      salaryCalculationMethod,
      firstSundayPattern,
      mappedRecords
    );

    if (format === "pdf") {
      // Build override map from attendance records
      const overrideMap = new Map(
        attendanceRecords.filter((r) => r.isManualOverride).map((r) => [r.date, true])
      );

      // Compute summary stats
      let totalFull = 0;
      let totalHalf = 0;
      let totalAbsent = 0;
      let totalOff = 0;
      for (const month of salaryResult.months) {
        for (const day of month.breakdown) {
          if (day.status === "FULL_DAY") totalFull++;
          else if (day.status === "HALF_DAY") totalHalf++;
          else if (day.status === "ABSENT") totalAbsent++;
          else if (day.status === "OFF") totalOff++;
        }
      }

      const statusLabel: Record<string, string> = {
        FULL_DAY: "Full Day",
        HALF_DAY: "Half Day",
        ABSENT: "Absent",
        OFF: "Off",
      };
      const statusColor: Record<string, string> = {
        FULL_DAY: "#10b981",
        HALF_DAY: "#f59e0b",
        ABSENT: "#ef4444",
        OFF: "#94a3b8",
      };

      // Build month summary rows
      const monthSummaryRows = salaryResult.months
        .map(
          (m) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${m.year}-${String(m.month).padStart(2, "0")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${m.totalCalendarDays}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${m.workingPayableCapacity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">₹${m.perDaySalary.toFixed(0)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${m.totalPayableDays}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">₹${m.totalSalary.toFixed(0)}</td>
        </tr>`
        )
        .join("");

      // Build daily breakdown rows
      const dailyRows = salaryResult.months
        .flatMap((m) => m.breakdown)
        .map((day) => {
          const date = new Date(day.date + "T00:00:00");
          const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
          const isOverride = overrideMap.has(day.date);
          const color = statusColor[day.status] || "#64748b";
          return `
          <tr>
            <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${day.date}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${dayName}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">
              <span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${statusLabel[day.status] || day.status}</span>
            </td>
            <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:center;">${day.payableValue}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;">₹${day.dailyPayment.toFixed(0)}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:center;">${isOverride ? "✓" : ""}</td>
          </tr>`;
        })
        .join("");

      // Compute attendance rate
      const workingCapacity = salaryResult.months.reduce((s, m) => s + m.workingPayableCapacity, 0);
      const attendanceRate = workingCapacity > 0 ? ((totalFull + totalHalf * 0.5) / workingCapacity * 100).toFixed(1) : "0.0";

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WorkSync Attendance Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #191b23; background: #fff; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 32px; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #2563eb; }
    .header h1 { font-size: 28px; font-weight: 800; color: #2563eb; margin-bottom: 4px; }
    .header p { font-size: 14px; color: #434655; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
    .info-card { background: #f8f9ff; border-radius: 12px; padding: 16px; border: 1px solid #e5e7eb; }
    .info-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #737686; margin-bottom: 4px; }
    .info-card .value { font-size: 16px; font-weight: 700; color: #191b23; }
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
    .stat-card { text-align: center; padding: 16px 8px; border-radius: 12px; }
    .stat-card .number { font-size: 24px; font-weight: 800; }
    .stat-card .label { font-size: 11px; margin-top: 2px; }
    .rate-banner { background: linear-gradient(135deg, #2563eb, #06b6d4); color: white; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 32px; }
    .rate-banner .rate { font-size: 48px; font-weight: 800; }
    .rate-banner .label { font-size: 14px; opacity: 0.8; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { background: #f3f3fe; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #434655; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
    thead th:not(:first-child) { text-align: center; }
    thead th:last-child { text-align: right; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #737686; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .container { padding: 20px; }
    }
    .print-btn { position: fixed; top: 16px; right: 16px; background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
    .print-btn:hover { background: #1d4ed8; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save PDF</button>
  <div class="container">
    <div class="header">
      <h1>WorkSync</h1>
      <p>Office Attendance Report</p>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <div class="label">Employee</div>
        <div class="value">${employee.name}</div>
      </div>
      <div class="info-card">
        <div class="label">Period</div>
        <div class="value">${fromDateStr} to ${toDateStr}</div>
      </div>
      <div class="info-card">
        <div class="label">Monthly Salary</div>
        <div class="value">₹${employee.monthlySalary.toLocaleString("en-IN")}</div>
      </div>
      <div class="info-card">
        <div class="label">Calculation Method</div>
        <div class="value">${salaryCalculationMethod.replace(/_/g, " ")}</div>
      </div>
    </div>

    <div class="rate-banner">
      <div class="rate">${attendanceRate}%</div>
      <div class="label">Overall Attendance Rate</div>
    </div>

    <div class="stats-row">
      <div class="stat-card" style="background:#d1fae5;">
        <div class="number" style="color:#065f46;">${totalFull}</div>
        <div class="label" style="color:#065f46;">Full Days</div>
      </div>
      <div class="stat-card" style="background:#fef3c7;">
        <div class="number" style="color:#92400e;">${totalHalf}</div>
        <div class="label" style="color:#92400e;">Half Days</div>
      </div>
      <div class="stat-card" style="background:#fee2e2;">
        <div class="number" style="color:#991b1b;">${totalAbsent}</div>
        <div class="label" style="color:#991b1b;">Absent</div>
      </div>
      <div class="stat-card" style="background:#f1f5f9;">
        <div class="number" style="color:#64748b;">${totalOff}</div>
        <div class="label" style="color:#64748b;">Off</div>
      </div>
    </div>

    <h2 style="font-size:16px;font-weight:700;margin-bottom:12px;color:#191b23;">Monthly Summary</h2>
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">Month</th>
          <th>Calendar</th>
          <th>Capacity</th>
          <th style="text-align:right;">Per Day</th>
          <th>Payable</th>
          <th style="text-align:right;">Salary</th>
        </tr>
      </thead>
      <tbody>
        ${monthSummaryRows}
        <tr style="background:#f3f3fe;font-weight:700;">
          <td style="padding:10px 12px;">Total</td>
          <td style="padding:10px 12px;text-align:center;"></td>
          <td style="padding:10px 12px;text-align:center;">${workingCapacity}</td>
          <td style="padding:10px 12px;text-align:right;"></td>
          <td style="padding:10px 12px;text-align:center;">${salaryResult.totalPayableDays}</td>
          <td style="padding:10px 12px;text-align:right;color:#2563eb;">₹${salaryResult.totalSalary.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
        </tr>
      </tbody>
    </table>

    <h2 style="font-size:16px;font-weight:700;margin-bottom:12px;color:#191b23;">Daily Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">Date</th>
          <th>Day</th>
          <th>Status</th>
          <th>Payable</th>
          <th style="text-align:right;">Payment</th>
          <th>Override</th>
        </tr>
      </thead>
      <tbody>
        ${dailyRows}
      </tbody>
    </table>

    <div class="footer">
      Generated by WorkSync on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} at ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
    </div>
  </div>
  <script>
    // Auto-trigger print dialog after a brief delay
    setTimeout(() => { window.print(); }, 500);
  </script>
</body>
</html>`;

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    if (format === "csv") {
      // Generate CSV content
      const rows: string[] = [];

      // Build override map from attendance records
      const overrideMap = new Map(
        attendanceRecords.filter((r) => r.isManualOverride).map((r) => [r.date, true])
      );

      // Header section
      rows.push("WorkSync Office Attendance Report");
      rows.push(`Employee,${employee.name}`);
      rows.push(`Period,${fromDateStr} to ${toDateStr}`);
      rows.push(`Monthly Salary,${employee.monthlySalary}`);
      rows.push(`Calculation Method,${employee.salaryCalculationMethod}`);
      rows.push(`Sunday Pattern,${employee.firstSundayPattern}`);
      rows.push("");

      // Summary section
      rows.push("=== Summary ===");
      rows.push("Month,Calendar Days,Working Capacity,Per Day Salary,Payable Days,Total Salary");
      for (const month of salaryResult.months) {
        rows.push(
          `${month.year}-${String(month.month).padStart(2, "0")},${month.totalCalendarDays},${month.workingPayableCapacity},${month.perDaySalary},${month.totalPayableDays},${month.totalSalary}`
        );
      }
      rows.push("");
      rows.push(`Total Payable Days,${salaryResult.totalPayableDays}`);
      rows.push(`Total Salary,${salaryResult.totalSalary}`);
      rows.push("");

      // Daily breakdown
      rows.push("=== Daily Breakdown ===");
      rows.push("Date,Day,Status,Payable Value,Daily Payment,Manual Override");
      for (const month of salaryResult.months) {
        for (const day of month.breakdown) {
          const date = new Date(day.date + "T00:00:00");
          const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
          const isOverride = overrideMap.has(day.date) ? "Yes" : "No";
          rows.push(
            `${day.date},${dayName},${day.status},${day.payableValue},${day.dailyPayment},${isOverride}`
          );
        }
      }

      const csvContent = rows.join("\n");

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="attendance-report-${fromDateStr}-to-${toDateStr}.csv"`,
        },
      });
    }

    // Default: return JSON
    return NextResponse.json({
      employee: {
        id: employee.id,
        name: employee.name,
        monthlySalary: employee.monthlySalary,
      },
      period: { from: fromDateStr, to: toDateStr },
      salary: salaryResult,
    });
  } catch (error) {
    console.error("Error exporting report:", error);
    return NextResponse.json(
      { error: "Failed to export report" },
      { status: 500 }
    );
  }
}
