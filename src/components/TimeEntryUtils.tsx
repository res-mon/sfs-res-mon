/**
 * TimeEntryUtils - Utility functions and shared types for the WorkClock component
 * This file contains reusable types, formatting utilities, and data processing
 * functions used by the WorkClock and related components.
 */
import { format, formatDistance } from "date-fns";
import { de } from "date-fns/locale";

import { TimeStampEntry } from "../services/workClock";

/**
 * Represents a pair of clock-in and clock-out entries
 */
export interface TimeEntryPair {
  clockInId: string | undefined;
  clockOutId: string | undefined;
  clockIn: number | null;
  clockOut: number | null;
  duration: number; // Duration in milliseconds
  dayBoundary: boolean; // Flag to indicate if this entry crosses midnight
  missingEntry: boolean; // Flag to indicate if this entry is missing its pair
}

/**
 * Represents a daily record of work time entries
 */
export interface DailyRecord {
  date: string;
  entryPairs: TimeEntryPair[];
  totalTime: number; // total milliseconds
  formattedTotal: string; // formatted duration
  hasMissingEntries: boolean; // Flag to indicate if this day has missing entries
  isActive: boolean; // Flag to indicate if there is an active session on this day
}

/**
 * Checks if two dates represent the same local day
 */
export function isSameLocalDay(a: Date | number, b: Date | number): boolean {
  if (typeof a === "number") {
    a = new Date(a);
  }
  if (typeof b === "number") {
    b = new Date(b);
  }

  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

/**
 * Format milliseconds into HH:MM:SS string
 */
export const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
};

/**
 * Cleanup a daily record that's not the active one
 */
export function cleanupMiddleRecord(record: DailyRecord) {
  if (!record.isActive) {
    return;
  }

  record.hasMissingEntries = true;
  record.isActive = false;

  record.totalTime = 0;
  for (const pair of record.entryPairs) {
    if (pair.clockIn == null || pair.clockOut == null) {
      pair.missingEntry = true;
      pair.duration = 0;
      pair.dayBoundary = false;
    } else {
      record.totalTime += pair.duration;
    }
  }
  record.formattedTotal = formatDuration(record.totalTime);
}

/**
 * Create time entry pairs from raw timestamp records
 * This function takes an array of individual clock-in and clock-out records
 * and pairs them together to create TimeEntryPair objects. It handles various
 * edge cases like missing clock-ins or clock-outs and active sessions.
 *
 * @param records - Array of TimeStampEntry objects from PocketBase sorted by oldest first
 * @returns Array of paired clock-in/clock-out entries
 */
function createPairs(records: TimeStampEntry[]): TimeEntryPair[] {
  const pairs: TimeEntryPair[] = [];
  let currentPair: TimeEntryPair | null = null;

  for (const record of records) {
    if (record.clock_in) {
      if (currentPair != null) {
        // If there is already a clock-in, we need to close the previous pair
        pairs.push(currentPair);
      }

      currentPair = {
        clockInId: record.id,
        clockOutId: undefined,
        clockIn: record.timestamp.getTime(),
        clockOut: null,
        duration: 0,
        dayBoundary: false,
        missingEntry: true,
      };
    } else {
      if (currentPair != null && currentPair.clockIn != null) {
        currentPair.clockOutId = record.id;
        currentPair.clockOut = record.timestamp.getTime();
        currentPair.duration = currentPair.clockOut - currentPair.clockIn;
        currentPair.missingEntry = false;
        currentPair.dayBoundary = !isSameLocalDay(
          currentPair.clockIn,
          currentPair.clockOut,
        );
        pairs.push(currentPair);
        currentPair = null;
      } else {
        // If there is a clock-out without a preceding clock-in
        pairs.push({
          clockInId: undefined,
          clockOutId: record.id,
          clockIn: null,
          clockOut: record.timestamp.getTime(),
          duration: 0,
          dayBoundary: false,
          missingEntry: true,
        });
        currentPair = null;
      }
    }
  }

  // If there is an unclosed pair it is the currently active session
  if (currentPair != null) {
    currentPair.missingEntry = false;
    pairs.push(currentPair);
  }

  return pairs;
}

/**
 * Extract the date string from a TimeEntryPair
 * Returns a formatted date string (YYYY-MM-DD) based on either the clock-in or clock-out timestamp.
 * If neither exists, returns the current date.
 *
 * @param pair - A TimeEntryPair object containing timestamp data
 * @returns Formatted date string in YYYY-MM-DD format
 */
function getPairDate(pair: TimeEntryPair): string {
  const date = new Date(pair.clockIn ?? pair.clockOut ?? new Date().getTime());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Cleanup all daily records and handle the active session
 */
export function cleanupDailyRecords(records: DailyRecord[]): DailyRecord[] {
  for (let i = 1; i < records.length; i++) {
    cleanupMiddleRecord(records[i]);
  }

  if (
    records.length > 0 &&
    records[0].isActive &&
    records[0].entryPairs.length > 0
  ) {
    const lastIndex = records[0].entryPairs.length - 1;
    if (records[0].entryPairs[lastIndex].clockIn != null) {
      records[0].entryPairs[lastIndex].dayBoundary = isSameLocalDay(
        records[0].entryPairs[lastIndex].clockIn,
        records[0].entryPairs[lastIndex].clockOut ?? new Date(),
      );
    }
  }

  return records;
}

/**
 * Process TimeStampEntry arrays into DailyRecord objects for UI display
 * This groups entries by date and pairs clock-in/clock-out entries
 *
 * @param entries - Array of TimeStampEntry objects from PocketBase sorted by oldest first
 * @returns Array of DailyRecord objects for UI rendering
 */
export function processTimeEntries(entries: TimeStampEntry[]): DailyRecord[] {
  // First create pairs from the raw timestamp entries
  const pairs = createPairs(entries);

  // Group pairs by date (YYYY-MM-DD)
  const pairsByDate: Record<string, TimeEntryPair[]> = {};

  // Group entry pairs by date
  pairs.forEach((pair) => {
    const date = getPairDate(pair);
    if (!(pairsByDate[date] as unknown as TimeEntryPair[] | undefined)) {
      pairsByDate[date] = [];
    }
    pairsByDate[date].push(pair);
  });

  // Create DailyRecord objects from the grouped pairs
  const dailyRecords: DailyRecord[] = [];

  Object.keys(pairsByDate).forEach((date) => {
    const dayPairs = pairsByDate[date];
    let totalTime = 0;
    let hasMissingEntries = false;
    let isActive = false;

    // Calculate totals and check for issues
    for (const pair of dayPairs) {
      // Check for missing entries
      if (pair.missingEntry) {
        hasMissingEntries = true;
      }

      // Check for active session
      if (
        pair.clockIn !== null &&
        pair.clockOut === null &&
        !pair.missingEntry
      ) {
        isActive = true;
        // For active sessions, calculate duration up to current time
        pair.duration = new Date().getTime() - pair.clockIn;
      }

      // Only add to total time if it's not missing an entry
      if (!pair.missingEntry) {
        totalTime += pair.duration;
      }
    }

    dailyRecords.push({
      date,
      entryPairs: dayPairs,
      totalTime,
      formattedTotal: formatDuration(totalTime),
      hasMissingEntries,
      isActive,
    });
  });

  // Sort daily records by date (newest first)
  dailyRecords.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return cleanupDailyRecords(dailyRecords);
}

/**
 * Format duration for display (DD Tage, HH:MM:SS or HH:MM:SS)
 * Converts milliseconds duration to a formatted time string
 *
 * @param durationMilliseconds - Duration in milliseconds to format
 * @returns Formatted string. If the duration includes days, it will show "X Tage, HH:MM:SS"
 *          Otherwise, it will just show "HH:MM:SS"
 */
export const formatDurationForDisplay = (
  durationMilliseconds: number,
): string => {
  // Calculate time components from milliseconds
  const totalSeconds = Math.floor(durationMilliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400); // 86400 = seconds in a day
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Format hours, minutes and seconds with padding
  const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Add days if present
  if (days > 0) {
    return `${days} Tage, ${timeString}`;
  }

  return timeString;
};

/**
 * Format timestamp for display as time
 * Converts a milliseconds timestamp to a formatted time string (24-hour format)
 *
 * @param timestamp - Timestamp in milliseconds to format
 * @returns Formatted time string in HH:mm:ss format
 */
export const formatTimeForDisplay = (timestamp: number): string => {
  const date = new Date(timestamp);
  return format(date, "HH:mm:ss");
};

/**
 * Format date for display (localized)
 */
export const formatDateForDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return format(date, "EEEE, d. MMMM yyyy", { locale: de });
};

/**
 * Format clock out date, showing date part when crossing days
 */
export const formatClockOutDate = (
  timestamp: number,
  clockInTimestamp: number,
): string => {
  const clockOutDate = new Date(timestamp);
  const clockInDate = new Date(clockInTimestamp);
  // Check if dates are different
  if (
    clockOutDate.getDate() !== clockInDate.getDate() ||
    clockOutDate.getMonth() !== clockInDate.getMonth() ||
    clockOutDate.getFullYear() !== clockInDate.getFullYear()
  ) {
    // Format with date for day crossings
    return format(clockOutDate, "d. MMM, HH:mm:ss", { locale: de });
  }
  // Just return time for same-day entries
  return format(clockOutDate, "HH:mm:ss");
};

/**
 * Get relative time string (e.g. "2 hours ago")
 */
export const getRelativeTime = (
  timestamp: number | null | undefined,
): string => {
  if (timestamp == null) return "";
  return formatDistance(new Date(timestamp), new Date(), {
    addSuffix: true,
    locale: de,
  });
};
