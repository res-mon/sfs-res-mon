/**
 * Work Clock Service Module
 *
 * This module provides Effect-based functions for managing work clock entries.
 * It handles the conversion between PocketBase's string-based dates and JavaScript Date objects,
 * as well as providing a clean API for creating, retrieving, and deleting time entries.
 * All operations use Effect for predictable error handling.
 */
import { ClientResponseError } from "pocketbase";

import { Effect, Schema, pipe } from "effect";
import { ParseError } from "effect/ParseResult";

import {
  WorkClockRecord,
  workClock,
  workClockSchema,
} from "./pocketBase/collections";
import {
  CreateRecordError,
  DateInvalidError,
  DateInvalidFormatError,
  DeleteRecordError,
  GetFullRecordListError,
  assertRFC3339Date,
  dateToRFC3339,
  rfc3339ToDate,
} from "./pocketBase/pocketBase";

/**
 * TimeStampEntry interface
 * Represents the type-hardened data structure for work clock entries with proper Date objects
 * Used for external API communication with the application
 *
 * @interface TimeStampEntry
 * @property {string} [id] - Optional unique identifier (may not be present for new entries)
 * @property {Date} timestamp - JavaScript Date object representing the timestamp
 * @property {boolean} clock_in - Flag to indicate type of entry (true=clock-in, false=clock-out)
 */
export interface TimeStampEntry {
  id?: string;
  timestamp: Date;
  clock_in: boolean; // true for clock-in, false for clock-out
}

/**
 * Parses and validates raw PocketBase record data into a type-safe TimeStampEntry
 *
 * This function performs two important validations:
 * 1. Schema validation against the workClockSchema
 * 2. Conversion of string timestamp to a JavaScript Date object
 *
 * @param {WorkClockRecord} value - Value to be parsed, typically a raw record from PocketBase
 * @returns An Effect that yields a validated TimeStampEntry with proper Date object,
 *          or fails with ParseError or DateInvalidFormatError
 * @private
 */
function parseTimeStampEntry(
  value: WorkClockRecord,
): Effect.Effect<TimeStampEntry, ParseError | DateInvalidFormatError, never> {
  return pipe(
    Schema.validate(workClockSchema)(value),
    Effect.flatMap((record) =>
      pipe(
        rfc3339ToDate(record.timestamp),
        Effect.mapError((error) => ({
          ...error,
          message: `Invalid date format from PocketBase for record ${record.id}: ${error.message}`,
        })),
        Effect.map(
          (timestampDate) =>
            ({
              id: record.id,
              timestamp: timestampDate,
              clock_in: record.clock_in,
            }) as TimeStampEntry,
        ),
      ),
    ),
  );
}

/**
 * Deletes a time entry by its ID
 *
 * @param id - The unique identifier of the time entry to delete
 * @returns An Effect that yields true if successful, or fails with DeleteRecordError
 * @example
 * // Delete a time entry
 * const result = await Effect.runPromise(deleteTimeEntry("record123"));
 */
export function deleteTimeEntry(
  id: string,
): Effect.Effect<boolean, DeleteRecordError> {
  return Effect.tryPromise({
    try: () => workClock().delete(id),
    catch: (error) => {
      const innerError =
        error instanceof ClientResponseError ? error : undefined;
      if (error != null && !innerError) {
        console.error(
          "Unexpected error occurred while deleting time entry:",
          error,
        );
      }
      return {
        type: "deleteRecord",
        message: `Failed to delete the time entry with id: "${id}".`,
        innerError,
      };
    },
  });
}

/**
 * Creates a filter string for date range queries
 * Helper function to build PocketBase filter expressions for time ranges
 *
 * @param from - Optional start Date or RFC3339 string (inclusive)
 * @param until - Optional end Date or RFC3339 string (exclusive)
 * @returns An Effect that yields a filter string for PocketBase queries, or fails with date-related errors
 * @private
 */
function betweenFilter(
  from: Date | undefined | string,
  until: Date | undefined | string,
): Effect.Effect<string, DateInvalidError | DateInvalidFormatError> {
  const fromStr =
    from != null ?
      typeof from === "string" ?
        assertRFC3339Date(from)
      : dateToRFC3339(from)
    : undefined;
  const untilStr =
    until != null ?
      typeof until === "string" ?
        assertRFC3339Date(until)
      : dateToRFC3339(until)
    : undefined;

  if (fromStr != null && untilStr != null) {
    return pipe(
      Effect.all([fromStr, untilStr]),
      Effect.map(([from, until]) => {
        return `timestamp >= '${from}' && timestamp < '${until}'`;
      }),
    );
  } else if (fromStr != null) {
    return pipe(
      fromStr,
      Effect.map((from) => `timestamp >= '${from}'`),
    );
  } else if (untilStr != null) {
    return pipe(
      untilStr,
      Effect.map((until) => `timestamp < '${until}'`),
    );
  }

  return Effect.succeed("");
}

/**
 * Union of possible error types returned by getTimeEntries function
 */
export type GetTimeEntriesError =
  | DateInvalidFormatError
  | DateInvalidError
  | GetFullRecordListError
  | ParseError;

/**
 * Get time entries within a specific date range using proper Date objects
 * Fetches all records that fall within the provided date range, sorted by timestamp descending
 *
 * @param from - Optional start Date (inclusive)
 * @param until - Optional end Date (exclusive)
 * @returns An Effect that yields an array of TimeStampEntry objects with proper Date timestamps,
 *          or fails with GetTimeEntriesError
 * @example
 * // Get all entries
 * const allEntries = await Effect.runPromise(getTimeEntries());
 *
 * // Get entries from a specific date
 * const fromDate = new Date('2025-03-01');
 * const specificEntries = await Effect.runPromise(getTimeEntries(fromDate));
 *
 * // Get entries within a date range
 * const startDate = new Date('2025-03-01');
 * const endDate = new Date('2025-03-31');
 * const rangeEntries = await Effect.runPromise(getTimeEntries(startDate, endDate));
 */
export function getTimeEntries(
  from?: Date,
  until?: Date,
): Effect.Effect<TimeStampEntry[], GetTimeEntriesError> {
  return pipe(
    betweenFilter(from, until),
    Effect.flatMap((filter: string) =>
      Effect.tryPromise({
        try: () =>
          workClock().getFullList({
            sort: "-timestamp", // Sort by timestamp descending (newest first)
            batch: 1000, // Batch 1000 records per request
            ...(filter ? { filter } : {}), // Only add the filter if it's not empty
          }),
        catch: (error) => {
          const innerError =
            error instanceof ClientResponseError ? error : undefined;
          if (error != null && !innerError) {
            console.error(
              "Unexpected error occurred while fetching time entries:",
              error,
            );
          }
          return {
            type: "getFullRecordList",
            message: `Failed to fetch time entries with filter: "${filter}".`,
            innerError,
          } as GetFullRecordListError;
        },
      }),
    ),
    Effect.flatMap((records) => Effect.all(records.map(parseTimeStampEntry))),
  );
}

/**
 * Union of possible error types returned by addClockEntry function
 */
export type AddClockEntryError =
  | DateInvalidError
  | CreateRecordError
  | DateInvalidFormatError
  | ParseError;

/**
 * Add a new clock-in or clock-out entry with proper Date handling
 * Creates a new record in the database with the provided timestamp or current time
 *
 * @param clockIn - Boolean indicating whether this is a clock-in (true) or clock-out (false) entry
 * @param timestamp - Optional Date object for the timestamp (defaults to current time)
 * @returns An Effect that yields the created TimeStampEntry with Date object,
 *          or fails with AddClockEntryError
 * @example
 * // Add a clock-in entry with the current time
 * const clockInEntry = await Effect.runPromise(addClockEntry(true));
 *
 * // Add a clock-out entry with a specific time
 * const specificTime = new Date('2025-03-28T17:30:00');
 * const clockOutEntry = await Effect.runPromise(addClockEntry(false, specificTime));
 */
export function addClockEntry(
  clockIn: boolean,
  timestamp: Date = new Date(),
): Effect.Effect<TimeStampEntry, AddClockEntryError> {
  return pipe(
    dateToRFC3339(timestamp),
    Effect.flatMap((timestampStr) => {
      // Prepare data for PocketBase
      const data = {
        timestamp: timestampStr,
        clock_in: clockIn,
      };

      // Create the record in PocketBase
      return Effect.tryPromise({
        try: () => workClock().create(data),
        catch: (error) => {
          const innerError =
            error instanceof ClientResponseError ? error : undefined;
          if (error != null && !innerError) {
            console.error(
              `Unexpected error occurred while adding ${clockIn ? "clock-in" : "clock-out"} entry with timestamp ${timestampStr}:`,
              error,
            );
          }
          return {
            type: "createRecord",
            message: `Failed to add ${clockIn ? "clock-in" : "clock-out"} entry with timestamp ${timestampStr}.`,
            innerError,
          } as CreateRecordError;
        },
      });
    }),
    Effect.flatMap((record) => parseTimeStampEntry(record)),
  );
}

/**
 * Type definition for Legacy Import-related errors
 */
export interface LegacyImportError {
  type: "legacyImport";
  message: string;
  innerError?: unknown;
}

/**
 * Type definition for Legacy Import response
 */
export interface LegacyImportResponse {
  success: boolean;
  message: string;
}

/**
 * Uploads a legacy database file for import into the work_clock collection
 *
 * This function takes a database file (usually .db SQLite file), uploads it to the
 * backend's /api/legacy_import endpoint, which extracts activity logs and imports
 * them into the PocketBase work_clock collection.
 *
 * @param file - The database file to upload (File or Blob)
 * @returns An Effect that yields the server response on success, or fails with LegacyImportError
 * @example
 * // Upload a database file from a file input
 * const fileInput = document.getElementById('fileInput') as HTMLInputElement;
 * const file = fileInput.files?.[0];
 * if (file) {
 *   const result = await Effect.runPromise(uploadLegacyDatabase(file));
 *   console.log(result.message);
 * }
 */
export function uploadLegacyDatabase(
  file: File | Blob,
): Effect.Effect<LegacyImportResponse, LegacyImportError> {
  return Effect.tryPromise({
    try: async () => {
      // Create a FormData object and append the file
      const formData = new FormData();
      formData.append(
        "database",
        file,
        file instanceof File ? file.name : "database.db",
      );

      // Send the request to the server
      const response = await fetch("/api/legacy_import", {
        method: "POST",
        body: formData,
      });

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = `Server returned ${response.status}: ${response.statusText}`;

        try {
          // Try to extract a more detailed error message from the response
          const errorData = (await response.json()) as unknown;
          if (typeof errorData === "string") {
            errorMessage = errorData;
          } else if (
            typeof errorData === "object" &&
            errorData != null &&
            "message" in errorData &&
            typeof errorData.message === "string"
          ) {
            errorMessage = errorData.message;
          }
        } catch {
          // If we can't parse the JSON, just use the status text
          errorMessage = response.statusText;
        }

        throw new Error(errorMessage);
      }

      // Parse the successful response
      return (await response.json()) as LegacyImportResponse;
    },
    catch: (error) => {
      console.error("Error uploading legacy database:", error);
      return {
        type: "legacyImport",
        message:
          error instanceof Error ?
            error.message
          : "Failed to upload legacy database file",
        innerError: error,
      };
    },
  });
}
