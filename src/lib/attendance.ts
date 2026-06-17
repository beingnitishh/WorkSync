// Core business logic for WorkSync Office Attendance Tracker

export enum AttendanceStatus {
  FULL_DAY = "FULL_DAY",
  HALF_DAY = "HALF_DAY",
  ABSENT = "ABSENT",
  OFF = "OFF",
}

export enum SalaryCalculationMethod {
  CALENDAR_DAYS = "CALENDAR_DAYS",
  FIXED_30_DAYS = "FIXED_30_DAYS",
  WORKING_DAYS = "WORKING_DAYS",
}

export enum FirstSundayPattern {
  HALF_DAY = "HALF_DAY",
  FULL_OFF = "FULL_OFF",
}

/** Payable value for each attendance status
 * Only ABSENT deducts salary — HALF_DAY and OFF are both paid as full day.
 */
export function getPayableValue(status: AttendanceStatus): number {
  switch (status) {
    case AttendanceStatus.FULL_DAY:
      return 1.0;
    case AttendanceStatus.HALF_DAY:
      return 1.0; // Half day is still paid as full day
    case AttendanceStatus.ABSENT:
      return 0;   // Only absent deducts salary
    case AttendanceStatus.OFF:
      return 1.0; // Off days are still paid
    default:
      return 0;
  }
}

/** Check if a date is a Sunday */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/** Format a Date to YYYY-MM-DD string */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD string to Date */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Get all Sundays between two dates (inclusive) */
export function getSundaysInRange(startDate: Date, endDate: Date): Date[] {
  const sundays: Date[] = [];
  const current = new Date(startDate);
  // Move to first Sunday
  while (current.getDay() !== 0 && current <= endDate) {
    current.setDate(current.getDate() + 1);
  }
  while (current <= endDate) {
    if (current.getDay() === 0) {
      sundays.push(new Date(current));
    }
    current.setDate(current.getDate() + 7);
  }
  return sundays;
}

/** Get all dates between two dates (inclusive) */
export function getDatesInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export interface SundayPatternResult {
  date: string;
  isSunday: boolean;
  status: AttendanceStatus;
}

/**
 * Generate Sunday pattern for a date range.
 * 
 * The pattern alternates: one Sunday is HALF_DAY, the next is OFF, and so on.
 * The anchor is determined by firstSundayPattern:
 * - HALF_DAY: 1st Sunday = HALF_DAY, 2nd = OFF, 3rd = HALF_DAY, ...
 * - FULL_OFF: 1st Sunday = OFF, 2nd = HALF_DAY, 3rd = OFF, ...
 */
export function generateSundayPattern(
  startDate: Date,
  endDate: Date,
  firstSundayPattern: FirstSundayPattern
): SundayPatternResult[] {
  const sundays = getSundaysInRange(startDate, endDate);
  const results: SundayPatternResult[] = [];

  for (let i = 0; i < sundays.length; i++) {
    let status: AttendanceStatus;
    if (firstSundayPattern === FirstSundayPattern.HALF_DAY) {
      // Odd index (0-based): HALF_DAY, even index+1: OFF
      status = i % 2 === 0 ? AttendanceStatus.HALF_DAY : AttendanceStatus.OFF;
    } else {
      // FULL_OFF: first Sunday is OFF
      status = i % 2 === 0 ? AttendanceStatus.OFF : AttendanceStatus.HALF_DAY;
    }

    results.push({
      date: formatDate(sundays[i]),
      isSunday: true,
      status,
    });
  }

  return results;
}

/**
 * Generate full attendance records for a date range based on employee settings.
 * - Weekdays (Mon-Sat) = FULL_DAY
 * - Sundays follow the alternating pattern based on firstSundayPattern
 * Note: HALF_DAY and OFF both have payableValue = 1.0 (paid as full day).
 *       Only ABSENT has payableValue = 0.
 */
export function generateAttendanceForRange(
  startDate: Date,
  endDate: Date,
  firstSundayPattern: FirstSundayPattern
): Array<{ date: string; status: AttendanceStatus; payableValue: number }> {
  const sundayPattern = generateSundayPattern(startDate, endDate, firstSundayPattern);
  const sundayMap = new Map<string, AttendanceStatus>();
  for (const sp of sundayPattern) {
    sundayMap.set(sp.date, sp.status);
  }

  const allDates = getDatesInRange(startDate, endDate);
  return allDates.map((date) => {
    const dateStr = formatDate(date);
    const dayOfWeek = date.getDay();
    let status: AttendanceStatus;

    if (dayOfWeek === 0) {
      // Sunday
      status = sundayMap.get(dateStr) ?? AttendanceStatus.OFF;
    } else {
      // Weekday (Mon-Sat)
      status = AttendanceStatus.FULL_DAY;
    }

    return {
      date: dateStr,
      status,
      payableValue: getPayableValue(status),
    };
  });
}

/**
 * Get the number of calendar days in a month
 */
export function getCalendarDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Get the total working payable capacity for a month.
 * Since HALF_DAY and OFF are now paid as full day (1.0 each),
 * the capacity equals the total calendar days in the month.
 * Only ABSENT (0) reduces payable days.
 */
export function getWorkingPayableCapacity(
  year: number,
  month: number,
  firstSundayPattern: FirstSundayPattern
): number {
  const startOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = getCalendarDaysInMonth(year, month);
  const endOfMonth = new Date(year, month - 1, daysInMonth);

  const records = generateAttendanceForRange(startOfMonth, endOfMonth, firstSundayPattern);
  let capacity = 0;
  for (const record of records) {
    capacity += record.payableValue;
  }
  return capacity;
}

export interface SalaryBreakdown {
  year: number;
  month: number;
  totalCalendarDays: number;
  workingPayableCapacity: number;
  perDaySalary: number;
  totalPayableDays: number;
  totalSalary: number;
  breakdown: Array<{
    date: string;
    status: string;
    payableValue: number;
    dailyPayment: number;
  }>;
}

/**
 * Calculate salary for a specific month
 */
export function calculateMonthSalary(
  year: number,
  month: number,
  monthlySalary: number,
  salaryCalculationMethod: SalaryCalculationMethod,
  firstSundayPattern: FirstSundayPattern,
  attendanceRecords: Array<{ date: string; status: string; payableValue: number; isManualOverride: boolean }>
): SalaryBreakdown {
  const totalCalendarDays = getCalendarDaysInMonth(year, month);
  const workingPayableCapacity = getWorkingPayableCapacity(year, month, firstSundayPattern);

  // Calculate per-day salary based on method
  let perDaySalary: number;
  switch (salaryCalculationMethod) {
    case SalaryCalculationMethod.CALENDAR_DAYS:
      perDaySalary = monthlySalary / totalCalendarDays;
      break;
    case SalaryCalculationMethod.FIXED_30_DAYS:
      perDaySalary = monthlySalary / 30;
      break;
    case SalaryCalculationMethod.WORKING_DAYS:
      perDaySalary = monthlySalary / workingPayableCapacity;
      break;
    default:
      perDaySalary = monthlySalary / 30;
  }

  // Build breakdown using actual attendance records
  let totalPayableDays = 0;
  const breakdown: SalaryBreakdown["breakdown"] = [];

  for (const record of attendanceRecords) {
    const dailyPayment = perDaySalary * record.payableValue;
    totalPayableDays += record.payableValue;
    breakdown.push({
      date: record.date,
      status: record.status,
      payableValue: record.payableValue,
      dailyPayment: Math.round(dailyPayment * 100) / 100,
    });
  }

  const totalSalary = Math.round(perDaySalary * totalPayableDays * 100) / 100;

  return {
    year,
    month,
    totalCalendarDays,
    workingPayableCapacity,
    perDaySalary: Math.round(perDaySalary * 100) / 100,
    totalPayableDays,
    totalSalary,
    breakdown,
  };
}

/**
 * Calculate salary for a date range that may cross month boundaries.
 * Each month is calculated separately and summed.
 */
export function calculateSalaryForRange(
  fromDate: Date,
  toDate: Date,
  monthlySalary: number,
  salaryCalculationMethod: SalaryCalculationMethod,
  firstSundayPattern: FirstSundayPattern,
  attendanceRecords: Array<{ date: string; status: string; payableValue: number; isManualOverride: boolean }>
): {
  totalSalary: number;
  totalPayableDays: number;
  months: SalaryBreakdown[];
} {
  // Group attendance records by month
  const recordsByMonth = new Map<string, typeof attendanceRecords>();
  for (const record of attendanceRecords) {
    const [y, m] = record.date.split("-").map(Number);
    const key = `${y}-${m}`;
    if (!recordsByMonth.has(key)) {
      recordsByMonth.set(key, []);
    }
    recordsByMonth.get(key)!.push(record);
  }

  const months: SalaryBreakdown[] = [];
  let totalSalary = 0;
  let totalPayableDays = 0;

  // Process each month in the range
  let current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  while (current <= toDate) {
    const y = current.getFullYear();
    const m = current.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;

    // Find matching records - need to handle both "2025-1" and "2025-01" formats
    let monthRecords = recordsByMonth.get(key);
    if (!monthRecords) {
      // Try alternative key format
      const altKey = `${y}-${m}`;
      monthRecords = recordsByMonth.get(altKey);
    }

    if (monthRecords && monthRecords.length > 0) {
      const result = calculateMonthSalary(
        y,
        m,
        monthlySalary,
        salaryCalculationMethod,
        firstSundayPattern,
        monthRecords
      );
      months.push(result);
      totalSalary += result.totalSalary;
      totalPayableDays += result.totalPayableDays;
    }

    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }

  return {
    totalSalary: Math.round(totalSalary * 100) / 100,
    totalPayableDays,
    months,
  };
}

/**
 * Validate date string format (YYYY-MM-DD)
 */
export function isValidDateString(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = parseDate(dateStr);
  return formatDate(date) === dateStr;
}
