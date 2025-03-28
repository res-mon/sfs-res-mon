/**
 * PocketBase Collection Type Definitions and Accessor Functions
 *
 * This module defines TypeScript interfaces for PocketBase collections and
 * provides accessor functions to retrieve typed collection references.
 * It establishes the data models used throughout the application and ensures
 * type safety when interacting with the PocketBase backend.
 */
import { RecordModel } from "pocketbase";

import { Schema } from "effect";

import pb from "./pocketBase";

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * Schema definition for work clock entries in PocketBase
 *
 * This schema is used for:
 * 1. Validation of data coming from PocketBase
 * 2. Providing type information through the Schema.Type property
 * 3. Ensuring consistency between frontend and backend data models
 */
export const workClockSchema = Schema.Struct({
  id: Schema.String, // Unique identifier for the record
  timestamp: Schema.String, // RFC3339 format Y-m-d H:i:s.uZ (e.g. 2025-03-28 18:45:27.123Z)
  clock_in: Schema.Boolean, // Flag to indicate type of entry (true=clock-in, false=clock-out)
});

/**
 * Converts the read-only Schema.Type into a writeable type
 * Necessary for PocketBase interaction where we need to update fields
 */
type WorkClockSchema = Writeable<typeof workClockSchema.Type>;

/**
 * WorkClockRecord interface
 * Extends PocketBase's RecordModel with our specific schema fields
 * Used for type safety when interacting with PocketBase collections
 *
 * @interface WorkClockRecord
 * @extends {RecordModel}
 * @property {string} id - Unique identifier (inherited from RecordModel)
 * @property {string} timestamp - Timestamp in RFC3339 format (Y-m-d H:i:s.uZ)
 * @property {boolean} clock_in - Flag to indicate clock in/out status
 */
export interface WorkClockRecord extends RecordModel, WorkClockSchema {
  // The RecordModel already includes id, created, updated fields
  timestamp: string; // RFC3339 format Y-m-d H:i:s.uZ (e.g. 2025-03-28 18:45:27.123Z)
  clock_in: boolean; // Flag to indicate type of entry (true=clock-in, false=clock-out)
}

/**
 * Returns a reference to the work_clock_entries collection with proper typing
 * This function provides a strongly-typed interface to the PocketBase collection
 * for time tracking entries.
 *
 * @returns A typed PocketBase collection reference for work clock entries
 */
export function workClock() {
  return pb.collection<WorkClockRecord>("work_clock");
}
