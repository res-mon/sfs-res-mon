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
 * Cleanup all daily records and handle the active session
 */
export function cleanupDailyRecords(records: DailyRecord[]): DailyRecord[] {
  // Sort by date (newest first)
  records.sort((a, b) => b.date.localeCompare(a.date));

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
 * @param entries - Array of TimeStampEntry objects from PocketBase
 * @returns Array of DailyRecord objects for UI rendering
 */
export function processTimeEntries(entries: TimeStampEntry[]): DailyRecord[] {
  // Group by date (YYYY-MM-DD)
  const entriesByDate: Record<string, TimeStampEntry[]> = {};

  // First pass: group entries by date
  entries.forEach((entry) => {
    const localDate = `${entry.timestamp.getFullYear()}-${String(
      entry.timestamp.getMonth() + 1,
    ).padStart(2, "0")}-${String(entry.timestamp.getDate()).padStart(2, "0")}`;
    if (
      (entriesByDate[localDate] as unknown as TimeStampEntry | undefined) ==
      null
    ) {
      entriesByDate[localDate] = [];
    }
    entriesByDate[localDate].push(entry);
  });

  // Second pass: create DailyRecord objects
  const dailyRecords: DailyRecord[] = [];

  Object.keys(entriesByDate).forEach((date) => {
    const dayEntries = entriesByDate[date];
    // Sort by timestamp (oldest first)
    dayEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const entryPairs: TimeEntryPair[] = [];
    let totalTime = 0;
    let hasMissingEntries = false;
    let isActive = false;

    // Create clock-in/clock-out pairs
    for (let i = 0; i < dayEntries.length; i++) {
      const entry = dayEntries[i];

      if (entry.clock_in) {
        // This is a clock-in, look for next clock-out
        const clockIn = entry.timestamp.getTime();
        let clockOut: number | null = null;
        let duration = 0;
        let dayBoundary = false;
        let missingEntry = false;

        // Look for matching clock-out
        if (i + 1 < dayEntries.length && !dayEntries[i + 1].clock_in) {
          // Found a clock-out
          const clockOutEntry = dayEntries[i + 1];
          clockOut = clockOutEntry.timestamp.getTime();
          duration = clockOut - clockIn;

          // Check for day boundary crossing
          dayBoundary = !isSameLocalDay(new Date(clockIn), new Date(clockOut));

          // Skip the clock-out in next iteration
          i++;
        } else {
          // No matching clock-out, user is still clocked in
          clockOut = null;
          duration = new Date().getTime() - clockIn;
          missingEntry = i !== dayEntries.length - 1;
          isActive = i === dayEntries.length - 1;

          // If it's not the last entry, it's a missing clock-out
          hasMissingEntries ||= missingEntry;
        }

        entryPairs.push({
          clockIn,
          clockOut,
          duration,
          dayBoundary,
          missingEntry,
        });

        // Only add to total time if it's not missing an entry (except for active sessions)
        if (!missingEntry || isActive) {
          totalTime += duration;
        }
      } else {
        // This is a clock-out without a preceding clock-in
        const clockOut = entry.timestamp.getTime();
        // Group with previous day if it's a clock-out without a clock-in
        entryPairs.push({
          clockIn: null,
          clockOut,
          duration: 0, // Unknown duration
          dayBoundary: false,
          missingEntry: true,
        });
        hasMissingEntries = true;
      }
    }

    dailyRecords.push({
      date,
      entryPairs,
      totalTime,
      formattedTotal: formatDuration(totalTime),
      hasMissingEntries,
      isActive,
    });
  });

  return cleanupDailyRecords(dailyRecords);
}

/**
 * Format time for display (HH:MM:SS)
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
