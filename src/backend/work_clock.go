// Work Clock Module for PocketBase
//
// This module provides comprehensive functionality to track work hours by implementing clock-in and clock-out
// operations. It exposes API endpoints to manage the clock state, including clocking in,
// clocking out, toggling the current state, modifying timestamps, deleting entries,
// and adding manual clock in/out pairs.
//
// The module ensures thread-safety when modifying clock status and prevents invalid state
// transitions (such as clocking in when already clocked in). All operations validate the
// clock state to maintain data integrity across the work time tracking system.
package backend

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// workClockMutex provides thread-safety for clock operations to prevent race conditions
// when multiple requests attempt to modify the clock state simultaneously.
var workClockMutex = sync.Mutex{}

// callSucceeded returns a success response to the client.
// It sets HTTP status code 200 and returns a JSON response with success: true
//
// Parameters:
// - e: The RequestEvent from the HTTP handler
//
// Returns:
// - An error if encoding or writing the response fails
func callSucceeded(e *core.RequestEvent) error {
	e.Response.Header().Set("Content-Type", "application/json")
	e.Response.WriteHeader(http.StatusOK)
	return json.NewEncoder(e.Response).Encode(map[string]bool{"success": true})
}

// parseBoolParam parses a boolean parameter from form data with validation.
//
// Parameters:
// - paramValue: The string value from the form
// - paramName: The name of the parameter (used in error messages)
//
// Returns:
// - A boolean representing the parsed value
// - An error if the value is missing or not a valid boolean
func parseBoolParam(paramValue string, paramName string) (bool, error) {
	if paramValue == "" {
		return false, fmt.Errorf("missing '%s' (bool) parameter", paramName)
	}

	boolValue, err := strconv.ParseBool(paramValue)
	if err != nil {
		return false, fmt.Errorf("invalid '%s' value. Expected 'true' or 'false'", paramName)
	}

	return boolValue, nil
}

// parseTimeParam parses a time parameter from form data with validation.
//
// Parameters:
// - paramValue: The string value from the form
// - paramName: The name of the parameter (used in error messages)
//
// Returns:
// - A time.Time representing the parsed timestamp
// - An error if the value is missing or not in RFC3339 format
func parseTimeParam(paramValue string, paramName string) (time.Time, error) {
	if paramValue == "" {
		return time.Time{}, fmt.Errorf("missing '%s' (string) parameter", paramName)
	}

	timeValue, err := time.Parse(time.RFC3339, paramValue)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid '%s' format. Expected RFC3339", paramName)
	}

	return timeValue, nil
}

// RegisterWorkClockAPI registers the work clock API endpoints with the PocketBase server.
// It creates multiple routes for managing clock state:
// - POST /api/work_clock - Accepts form data to clock in or out
// - GET /api/work_clock/clock_in - Clocks in the user
// - GET /api/work_clock/clock_out - Clocks out the user
// - GET /api/work_clock/toggle - Toggles between clock in and clock out states
// - POST /api/work_clock/delete - Deletes a clock in/out pair by the clock in ID
// - POST /api/work_clock/modify - Modifies the timestamp of an existing work clock record
// - POST /api/work_clock/clock_in_out_at - Clocks in or out at a specific timestamp
// - POST /api/work_clock/add_clock_in_out_pair - Adds a clock in/out pair with specified timestamps
//
// All endpoints return a success response on success or an appropriate error response on failure.
//
// Parameters:
// - app: The PocketBase application instance
func RegisterWorkClockAPI(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/work_clock", func(e *core.RequestEvent) error {
			clockInBool, err := parseBoolParam(e.Request.FormValue("clock_in"), "clock_in")
			if err != nil {
				return e.Error(http.StatusBadRequest, err.Error(), nil)
			}

			if err := clockInOut(app, clockInBool); err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to clock in/out: %v", err), err)
			}
			return callSucceeded(e)
		})

		se.Router.GET("/api/work_clock/clock_in", func(e *core.RequestEvent) error {
			if err := clockInOut(app, true); err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to clock in: %v", err), err)
			}
			return callSucceeded(e)
		})
		se.Router.GET("/api/work_clock/clock_out", func(e *core.RequestEvent) error {
			if err := clockInOut(app, false); err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to clock out: %v", err), err)
			}
			return callSucceeded(e)
		})

		se.Router.GET("/api/work_clock/toggle", func(e *core.RequestEvent) error {
			clockedIn, err := isCurrentlyClockedIn(app)
			if err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to check current clock status: %v", err), err)
			}

			if err := clockInOut(app, !clockedIn); err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to toggle clock status: %v", err), err)
			}
			return callSucceeded(e)
		})

		se.Router.POST("/api/work_clock/delete", func(e *core.RequestEvent) error {
			clockInID := e.Request.FormValue("clock_in_id")
			if clockInID == "" {
				return e.Error(http.StatusBadRequest, "Missing 'clock_in_id' (string) parameter", nil)
			}

			if err := deleteClockInOutPair(app, clockInID); err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to delete clock in/out pair: %v", err), err)
			}

			return callSucceeded(e)
		})

		se.Router.POST("/api/work_clock/modify", func(e *core.RequestEvent) error {
			workClockID := e.Request.FormValue("work_clock_id")
			if workClockID == "" {
				return e.Error(http.StatusBadRequest, "Missing 'work_clock_id' (string) parameter", nil)
			}

			newTimestamp, err := parseTimeParam(e.Request.FormValue("new_timestamp"), "new_timestamp")
			if err != nil {
				return e.Error(http.StatusBadRequest, err.Error(), nil)
			}

			if err := modifyWorkClockTimestamp(app, workClockID, newTimestamp); err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to modify work clock timestamp: %v", err), err)
			}
			return callSucceeded(e)
		})

		se.Router.POST("/api/work_clock/clock_in_out_at", func(e *core.RequestEvent) error {
			clockInBool, err := parseBoolParam(e.Request.FormValue("clock_in"), "clock_in")
			if err != nil {
				return e.Error(http.StatusBadRequest, err.Error(), nil)
			}

			timestamp, err := parseTimeParam(e.Request.FormValue("timestamp"), "timestamp")
			if err != nil {
				return e.Error(http.StatusBadRequest, err.Error(), nil)
			}

			if err := clockInOutAt(app, clockInBool, timestamp); err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to clock %s at %s: %v", map[bool]string{true: "in", false: "out"}[clockInBool], timestamp.Format(time.RFC3339), err), err)
			}
			return callSucceeded(e)
		})

		se.Router.POST("/api/work_clock/add_clock_in_out_pair", func(e *core.RequestEvent) error {
			clockInTimestamp, err := parseTimeParam(e.Request.FormValue("clock_in_timestamp"), "clock_in_timestamp")
			if err != nil {
				return e.Error(http.StatusBadRequest, err.Error(), nil)
			}

			clockOutTimestamp, err := parseTimeParam(e.Request.FormValue("clock_out_timestamp"), "clock_out_timestamp")
			if err != nil {
				return e.Error(http.StatusBadRequest, err.Error(), nil)
			}

			if err := addClockInOutPair(app, clockInTimestamp, clockOutTimestamp); err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to add clock in/out pair: %v", err), err)
			}
			return callSucceeded(e)
		})

		return se.Next()
	})

}

// isCurrentlyClockedIn checks if the user is currently clocked in by retrieving
// the most recent record from the work_clock collection.
//
// Parameters:
// - app: The PocketBase application instance
//
// Returns:
// - A boolean indicating whether the user is clocked in (true) or out (false)
// - An error if the database query fails
//
// If no records exist, the function returns false, indicating the user is not clocked in.
func isCurrentlyClockedIn(app *pocketbase.PocketBase) (bool, error) {
	records, err := app.FindRecordsByFilter("work_clock", "", "-timestamp", 1, 0)
	if err != nil {
		return false, fmt.Errorf("failed to find latest work clock record: %w", err)
	}

	if len(records) == 0 {
		return false, nil
	}

	return records[0].GetBool("clock_in"), nil
}

// clockInOut performs the clock in or clock out operation based on the provided flag.
// This function ensures thread-safety using a mutex and prevents invalid state transitions
// (such as clocking in when already clocked in).
//
// Parameters:
// - app: The PocketBase application instance
// - clockIn: A boolean flag indicating the desired clock state (true = clock in, false = clock out)
//
// Returns:
// - An error if the operation fails or if the requested state matches the current state
//
// The function creates a new record in the work_clock collection with the current timestamp
// and the requested clock state.
func clockInOut(app *pocketbase.PocketBase, clockIn bool) error {
	workClockMutex.Lock()
	defer workClockMutex.Unlock()

	isClockedIn, err := isCurrentlyClockedIn(app)
	if err != nil {
		return fmt.Errorf("failed to check current clock status: %w", err)
	}

	if isClockedIn == clockIn {
		return fmt.Errorf("already clocked %s", map[bool]string{true: "in", false: "out"}[isClockedIn])
	}

	collection, err := app.FindCollectionByNameOrId("work_clock")
	if err != nil {
		return fmt.Errorf("failed to find work clock collection: %w", err)
	}
	record := core.NewRecord(collection)
	record.Set("timestamp", time.Now())
	record.Set("clock_in", clockIn)

	if err := app.Save(record); err != nil {
		return fmt.Errorf("failed to save work clock record: %w", err)
	}

	return nil
}

// deleteClockInOutPair deletes a clock in record and its corresponding clock out record.
// It requires the ID of the clock in record and will automatically find and delete the matching
// clock out record if it exists.
//
// Parameters:
// - app: The PocketBase application instance
// - clockInID: The ID of the clock in record to delete
//
// Returns:
// - An error if the operation fails, the record doesn't exist, or if it's not a clock in record
//
// The operation is performed within a transaction to ensure data consistency.
func deleteClockInOutPair(app *pocketbase.PocketBase, clockInID string) error {
	workClockMutex.Lock()
	defer workClockMutex.Unlock()

	record, err := app.FindRecordById("work_clock", clockInID)
	if err != nil {
		return fmt.Errorf("failed to find work clock record with id '%s': %w", clockInID, err)
	}
	if !record.GetBool("clock_in") {
		return fmt.Errorf("record with id '%s' is not a clock in record", clockInID)
	}

	succeedingRecords, err := app.FindRecordsByFilter("work_clock", "timestamp > {:clockIn}", "+timestamp", 1, 0, dbx.Params{
		"clockIn": record.GetDateTime("timestamp"),
	})
	if err != nil {
		return fmt.Errorf("failed to find succeeding work clock record: %w", err)
	}

	if len(succeedingRecords) > 0 && !succeedingRecords[0].GetBool("clock_in") {
		return fmt.Errorf("succeeding record with id '%s' is not a clock out record", succeedingRecords[0].Id)
	}

	err = app.RunInTransaction(func(txApp core.App) error {
		if err := txApp.Delete(record); err != nil {
			return fmt.Errorf("failed to delete clock in record: %w", err)
		}

		if len(succeedingRecords) > 0 {
			if err := txApp.Delete(succeedingRecords[0]); err != nil {
				return fmt.Errorf("failed to delete clock out record: %w", err)
			}
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to delete work clock records: %w", err)
	}

	return nil
}

// checkValidity verifies that a work clock record maintains logical sequence with adjacent records.
// It ensures that:
// - Clock in records are followed by clock out records
// - Clock out records are followed by clock in records
// - Clock in records are preceded by clock out records
// - Clock out records are preceded by clock in records
//
// This function is crucial for maintaining data integrity when adding, modifying, or deleting records.
//
// Parameters:
// - app: The core.App interface (typically a PocketBase transaction)
// - workClockID: The ID of the work clock record to validate
//
// Returns:
// - An error if the validation fails, with a detailed message explaining the issue
func checkValidity(app core.App, workClockID string) error {
	// Check if the work clock ID is valid
	if workClockID == "" {
		return fmt.Errorf("work clock ID cannot be empty")
	}

	// Check if the work clock record exists
	record, err := app.FindRecordById("work_clock", workClockID)
	if err != nil {
		return fmt.Errorf("failed to find work clock record with id '%s': %w", workClockID, err)
	}

	succeedingRecords, err := app.FindRecordsByFilter("work_clock", "timestamp > {:clockIn}", "+timestamp", 1, 0, dbx.Params{
		"clockIn": record.GetDateTime("timestamp"),
	})
	if err != nil {
		return fmt.Errorf("failed to find succeeding work clock record: %w", err)
	}

	if len(succeedingRecords) > 0 && succeedingRecords[0].GetBool("clock_in") != record.GetBool("clock_in") {
		if record.GetBool("clock_in") {
			return fmt.Errorf("expected the succeeding work clock record with id '%s' to be a clock out record", succeedingRecords[0].Id)
		} else {
			return fmt.Errorf("expected the succeeding work clock record with id '%s' to be a clock in record", succeedingRecords[0].Id)
		}
	}

	precedingRecords, err := app.FindRecordsByFilter("work_clock", "timestamp < {:clockIn}", "-timestamp", 1, 0, dbx.Params{
		"clockIn": record.GetDateTime("timestamp"),
	})
	if err != nil {
		return fmt.Errorf("failed to find preceding work clock record: %w", err)
	}

	if len(precedingRecords) > 0 && precedingRecords[0].GetBool("clock_in") == record.GetBool("clock_in") {
		if record.GetBool("clock_in") {
			return fmt.Errorf("expected the preceding work clock record with id '%s' to be a clock out record", precedingRecords[0].Id)
		} else {
			return fmt.Errorf("expected the preceding work clock record with id '%s' to be a clock in record", precedingRecords[0].Id)
		}
	}

	return nil
}

// modifyWorkClockTimestamp updates the timestamp of an existing work clock record.
// After modifying the timestamp, it validates that the record maintains proper sequence
// with adjacent records to ensure data integrity.
//
// Parameters:
// - app: The PocketBase application instance
// - workClockID: The ID of the work clock record to modify
// - newTimestamp: The new timestamp to set for the record
//
// Returns:
// - An error if the update fails or if the modified record violates sequence constraints
//
// The operation is performed within a transaction to ensure data consistency.
func modifyWorkClockTimestamp(app *pocketbase.PocketBase, workClockID string, newTimestamp time.Time) error {
	workClockMutex.Lock()
	defer workClockMutex.Unlock()

	record, err := app.FindRecordById("work_clock", workClockID)
	if err != nil {
		return fmt.Errorf("failed to find work clock record with id '%s': %w", workClockID, err)
	}

	err = app.RunInTransaction(func(txApp core.App) error {
		record.Set("timestamp", newTimestamp)
		if err := txApp.Save(record); err != nil {
			return fmt.Errorf("failed to save work clock record with new timestamp: %w", err)
		}

		if err := checkValidity(txApp, workClockID); err != nil {
			return fmt.Errorf("modified work clock record with id '%s' is not valid anymore: %w", workClockID, err)
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to modify work clock record with id '%s': %w", workClockID, err)
	}

	return nil
}

// clockInOutAt creates a new clock in or clock out record with a specific timestamp.
// This allows for manual time entries when the actual clock in/out didn't occur in real-time.
// The function validates that the new record maintains proper sequence with existing records.
//
// Parameters:
// - app: The PocketBase application instance
// - clockIn: Boolean flag indicating whether this is a clock in (true) or clock out (false) record
// - timestamp: The specific timestamp to use for the record
//
// Returns:
// - An error if the operation fails or if adding the record would violate sequence constraints
//
// The operation is performed within a transaction to ensure data consistency.
func clockInOutAt(app *pocketbase.PocketBase, clockIn bool, timestamp time.Time) error {
	workClockMutex.Lock()
	defer workClockMutex.Unlock()

	err := app.RunInTransaction(func(txApp core.App) error {
		collection, err := txApp.FindCollectionByNameOrId("work_clock")
		if err != nil {
			return fmt.Errorf("failed to find work clock collection: %w", err)
		}
		record := core.NewRecord(collection)
		record.Set("timestamp", timestamp)
		record.Set("clock_in", clockIn)

		if err := txApp.Save(record); err != nil {
			return fmt.Errorf("failed to save work clock record: %w", err)
		}

		if err := checkValidity(txApp, record.Id); err != nil {
			return fmt.Errorf("modified work clock record with id '%s' is not valid: %w", record.Id, err)
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to clock %s at %s: %w", map[bool]string{true: "in", false: "out"}[clockIn], timestamp.Format(time.RFC3339), err)
	}

	return nil
}

// addClockInOutPair creates a pair of clock in and clock out records with specified timestamps.
// This is useful for entering historical or pre-planned work periods.
// Both records are validated to ensure they maintain proper sequence with existing records.
//
// Parameters:
// - app: The PocketBase application instance
// - clockInTimestamp: The timestamp for the clock in record
// - clockOutTimestamp: The timestamp for the clock out record
//
// Returns:
// - An error if the operation fails or if adding the records would violate sequence constraints
//
// The operation is performed within a transaction to ensure data consistency. There is no
// requirement that clockInTimestamp must be before clockOutTimestamp, allowing for flexibility
// in special cases like splitting an existing time period.
func addClockInOutPair(app *pocketbase.PocketBase, clockInTimestamp, clockOutTimestamp time.Time) error {
	workClockMutex.Lock()
	defer workClockMutex.Unlock()

	err := app.RunInTransaction(func(txApp core.App) error {
		collection, err := txApp.FindCollectionByNameOrId("work_clock")
		if err != nil {
			return fmt.Errorf("failed to find work clock collection: %w", err)
		}

		clockInRecord := core.NewRecord(collection)
		clockInRecord.Set("timestamp", clockInTimestamp)
		clockInRecord.Set("clock_in", true)

		if err := txApp.Save(clockInRecord); err != nil {
			return fmt.Errorf("failed to save clock in record: %w", err)
		}

		clockOutRecord := core.NewRecord(collection)
		clockOutRecord.Set("timestamp", clockOutTimestamp)
		clockOutRecord.Set("clock_in", false)

		if err := txApp.Save(clockOutRecord); err != nil {
			return fmt.Errorf("failed to save clock out record: %w", err)
		}

		if err := checkValidity(txApp, clockInRecord.Id); err != nil {
			return fmt.Errorf("modified clock in record with id '%s' is not valid: %w", clockInRecord.Id, err)
		}

		if err := checkValidity(txApp, clockOutRecord.Id); err != nil {
			return fmt.Errorf("modified clock out record with id '%s' is not valid: %w", clockOutRecord.Id, err)
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to add clock in/out pair: %w", err)
	}

	return nil
}
