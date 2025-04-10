/**
 * PocketBase Client Configuration and Helper Functions
 *
 * This module configures and exports a singleton PocketBase client instance
 * along with utility functions for handling date formatting required by PocketBase.
 * It also provides Effect-based error handling patterns for PocketBase operations.
 */
import PocketBase, { ClientResponseError } from "pocketbase";

import { Effect, pipe } from "effect";

// Create a single PocketBase instance to be used throughout the app
// This ensures we have only one connection to the backend
const pb = new PocketBase();

export default pb;

/**
 * Generic error type for consistent error handling throughout the application
 *
 * @template T - String literal type identifying the specific error
 * @property {T} type - Type of the error for exhaustive error handling
 * @property {string} message - Human readable error message for concatenation and error logging
 */
export type Error<T extends string> = {
  type: T; // Type of the error for exhaustive error handling.
  message: string; // Human readable error message for concatenation and error logging.
};

/**
 * Wraps an existing error with additional context by prepending and/or appending text to the error message
 * This function maintains the original error type while enriching the message with more context
 *
 * @template TErrorType - String literal type identifying the specific error
 * @template TError - The error type extending Error<TErrorType>
 * @param {string} [prependMessage=""] - Text to prepend to the error message
 * @param {TError} error - The original error object to wrap
 * @param {string} [appendMessage=""] - Text to append to the error message
 * @returns {TError} A new error object with the same type but modified message
 * @example
 * // Returns { type: "dateInvalid", message: "Failed to process date: The provided date is invalid. Please try again." }
 * wrapError(
 *   "Failed to process date:",
 *   { type: "dateInvalid", message: "The provided date is invalid." },
 *   "Please try again."
 * )
 */
export function wrapError<
  TErrorType extends string,
  TError extends Error<TErrorType>,
>(prependMessage = "", error: TError, appendMessage = ""): TError {
  const message = `${prependMessage ? prependMessage + " " : ""}${error.message}${appendMessage ? " " + appendMessage : ""}`;
  return {
    ...error,
    message,
  };
}

/**
 * Extended error type that wraps PocketBase ClientResponseError
 * Used for errors that occur during PocketBase API operations
 *
 * @template T - String literal type identifying the specific error
 * @extends {Error<T>}
 * @property {ClientResponseError} [innerError] - Original PocketBase error for additional context
 */
export type ResponseError<T extends string> = Error<T> & {
  innerError?: ClientResponseError;
};

/**
 * Error type for record deletion operations
 *
 * @extends {ResponseError<"deleteRecord">}
 */
export type DeleteRecordError = ResponseError<"deleteRecord">;

/**
 * Error type for record creation operations
 *
 * @extends {ResponseError<"createRecord">}
 */
export type CreateRecordError = ResponseError<"createRecord">;

/**
 * Error type for fetching a list of records
 *
 * @extends {ResponseError<"getFullRecordList">}
 */
export type GetFullRecordListError = ResponseError<"getFullRecordList">;

/**
 * Error type for invalid Date objects
 *
 * @extends {Error<"dateInvalid">}
 */
export type DateInvalidError = Error<"dateInvalid">;

/**
 * Error type for invalid date string formats
 *
 * @extends {Error<"dateInvalidFormat">}
 */
export type DateInvalidFormatError = Error<"dateInvalidFormat">;

/**
 * Splits a Date object into RFC3339 date and time parts
 * Used as a helper function for date formatting
 *
 * @param date - The JavaScript Date object to convert
 * @returns An Effect that yields a tuple containing the date part and time part as strings, or fails with DateInvalidError
 */
export function dateToRFC3339Parts(
  date: Date,
): Effect.Effect<[string, string], DateInvalidError | DateInvalidFormatError> {
  if (isNaN(date.getTime())) {
    return Effect.fail({
      type: "dateInvalid",
      message: "The provided date is invalid.",
    });
  }

  // First try splitting with 'T' separator (ISO standard)
  let parts = date.toISOString().split("T");

  // Fallback to space separator if needed
  if (parts.length !== 2) {
    parts = date.toISOString().split(" ");
  }

  // If we still don't have two parts, the date format is unexpected
  if (parts.length !== 2) {
    return Effect.fail({
      type: "dateInvalidFormat",
      message:
        "Unexpected date format: ISO string did not contain 'T' or ' ' separator.",
    });
  }

  return Effect.succeed(parts as [string, string]);
}

/**
 * Formats a Date object to RFC3339 format with space separator
 * This format is expected by PocketBase when storing timestamps
 *
 * @param date - The JavaScript Date object to convert
 * @returns An Effect that yields a string in RFC3339 format (YYYY-MM-DD HH:MM:SS.sssZ), or fails with DateInvalidError
 * @example
 * // Returns "2025-03-28 12:30:45.000Z"
 * dateToRFC3339(new Date())
 */
export function dateToRFC3339(
  date: Date,
): Effect.Effect<string, DateInvalidError | DateInvalidFormatError> {
  return pipe(
    dateToRFC3339Parts(date),
    Effect.map((parts) => parts.join(" ")),
  );
}

/**
 * Converts an RFC3339 string to a JavaScript Date object
 * Handles both space-separated and T-separated RFC3339 formats
 *
 * @param dateString - The RFC3339 formatted date string to convert
 * @returns An Effect that yields a JavaScript Date object, or fails with DateInvalidFormatError
 * @example
 * // Both formats are supported:
 * rfc3339ToDate("2025-03-28 12:30:45.000Z")
 * rfc3339ToDate("2025-03-28T12:30:45.000Z")
 */
export function rfc3339ToDate(
  dateString: string,
): Effect.Effect<Date, DateInvalidFormatError> {
  if (!dateString) {
    return Effect.fail({
      type: "dateInvalidFormat",
      message: "The provided date string is empty.",
    });
  }

  // Convert space-separated format to T-separated for JavaScript Date compatibility
  const formattedDate =
    dateString.indexOf(" ") !== -1 && dateString.indexOf("T") === -1 ?
      dateString.split(" ").join("T")
    : dateString;

  // Create and validate the date
  const date = new Date(formattedDate);
  if (isNaN(date.getTime())) {
    return Effect.fail({
      type: "dateInvalidFormat",
      message: `The provided date string "${dateString}" is invalid.`,
    });
  }
  return Effect.succeed(date);
}

/**
 * Validates and normalizes an RFC3339 date string
 * Parses a date string to ensure it's valid and then reformats it to the standard format
 *
 * @param dateString - The RFC3339 formatted date string to validate and normalize
 * @returns An Effect that yields the normalized RFC3339 date string, or fails with DateInvalidFormatError or DateInvalidError
 * @example
 * // Returns "2025-03-28 12:30:45.000Z" (normalized format)
 * assertRFC3339Date("2025-03-28T12:30:45.000Z")
 */
export function assertRFC3339Date(
  dateString: string,
): Effect.Effect<string, DateInvalidFormatError | DateInvalidError> {
  return pipe(
    rfc3339ToDate(dateString),
    Effect.flatMap((date) => dateToRFC3339(date)),
  );
}
