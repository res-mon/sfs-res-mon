// Legacy Import Module for PocketBase
//
// This module provides functionality to import data from legacy SQLite databases
// into PocketBase collections. It exposes an API endpoint that accepts SQLite database
// file uploads, extracts activity logs, and imports them into the work_clock collection.
//
// The import process handles the conversion from the legacy data structure to the
// current PocketBase schema.
package backend

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	_ "modernc.org/sqlite"
)

// ActivityLog represents a record from the activity_log table in legacy databases.
// It stores the timestamp of an activity event and whether the user was active (clock-in)
// or inactive (clock-out) at that time.
type ActivityLog struct {
	Timestamp time.Time `json:"timestamp"` // Time of the activity event
	Active    bool      `json:"active"`    // true = clock-in, false = clock-out
}

// RegisterLegacyImportAPI registers the legacy import endpoint with the PocketBase server.
// It creates a POST route at '/api/legacy_import' that accepts database files for import.
func RegisterLegacyImportAPI(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/legacy_import", func(e *core.RequestEvent) error {
			return handleLegacyImportPost(app, e)
		})
		return se.Next()
	})
}

// handleLegacyImportPost processes HTTP POST requests for the legacy import endpoint.
// It handles file uploads, validates the file, processes the contained data,
// and responds with the results of the import operation.
//
// Parameters:
// - app: The PocketBase application instance
// - req: The HTTP request containing the multipart form with the database file
// - resp: The HTTP response writer to return results to the client
//
// Returns an error if any part of the import process fails.
func handleLegacyImportPost(app *pocketbase.PocketBase, e *core.RequestEvent) error {
	// Max upload size of 50MB
	const maxUploadSize = 50 * 1024 * 1024
	e.Request.Body = http.MaxBytesReader(e.Response, e.Request.Body, maxUploadSize)

	// Parse the multipart form (max 50MB in memory)
	if err := e.Request.ParseMultipartForm(maxUploadSize); err != nil {
		return e.Error(http.StatusBadRequest, "File too large or invalid multipart form", err)
	}

	// Get the uploaded file
	file, header, err := e.Request.FormFile("database")
	if err != nil {
		return e.Error(http.StatusBadRequest, "Failed to get uploaded file", err)
	}
	defer file.Close()

	// Check file extension (optional, can be removed if any file type is acceptable)
	if filepath.Ext(header.Filename) != ".db" {
		return e.Error(http.StatusBadRequest, "Only .db files are allowed",
			fmt.Errorf("invalid file extension: %s", filepath.Ext(header.Filename)))
	}

	// Create a temporary directory
	tempDir, err := os.MkdirTemp("", "legacy_import_*")
	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to create temporary directory", err)
	}

	// Create a new file in the temp directory
	tempFilePath := filepath.Join(tempDir, header.Filename)
	tempFile, err := os.Create(tempFilePath)
	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to create temporary file", err)
	}
	defer os.Remove(tempFilePath) // Clean up the temp file after processing
	defer tempFile.Close()

	// Copy the uploaded file to the temporary file
	_, err = io.Copy(tempFile, file)
	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to save uploaded file", err)
	}

	// Read activity logs from the database
	activityLogs, err := readActivityLogs(tempFilePath)
	if err != nil {
		return e.Error(http.StatusInternalServerError,
			fmt.Sprintf("Failed to read activity logs: %v", err), err)
	}

	// Import activity logs into the PocketBase collection
	err = importActivityLogs(app, activityLogs)
	if err != nil {
		return e.Error(http.StatusInternalServerError,
			fmt.Sprintf("Failed to import activity logs: %v", err), err)
	}

	// Return success response
	e.Response.Header().Set("Content-Type", "application/json")
	e.Response.WriteHeader(http.StatusOK)
	return json.NewEncoder(e.Response).Encode(map[string]interface{}{
		"success": true,
		"message": "File uploaded and processed successfully",
	})
}

// readActivityLogs reads activity logs from a SQLite database file.
//
// It attempts to read data from both legacy formats: the 'activity_log' table
// and the 'ActiveChanges' table, combining results from both if they exist.
//
// Parameters:
// - dbPath: Path to the SQLite database file
//
// Returns:
// - A slice of ActivityLog objects containing the extracted log data
// - An error if the database could not be opened or queried, or if neither required table exists
func readActivityLogs(dbPath string) ([]ActivityLog, error) {
	// Open the SQLite database
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	var activityLogs []ActivityLog

	// Check if the activity_log table exists and read from it
	activityLogExists, err := readActivityLogTable(db, &activityLogs)
	if err != nil {
		return nil, fmt.Errorf("failed to read activity_log table: %w", err)
	}

	activeChangesExists, err := readActiveChangesTable(db, &activityLogs)
	if err != nil {
		return nil, fmt.Errorf("failed to read ActiveChanges table: %w", err)
	}
	if !activityLogExists && !activeChangesExists {
		return nil, fmt.Errorf("no 'activity_log' or 'ActiveChanges' table found in the database")
	}

	return activityLogs, nil
}

// readActivityLogTable reads activity logs from the 'activity_log' table in a legacy SQLite database.
//
// This function checks if the 'activity_log' table exists and extracts records if found.
// Each record is converted to the ActivityLog format and appended to the result slice.
//
// Parameters:
// - db: An open SQLite database connection
// - result: A pointer to the slice where ActivityLog entries will be appended
//
// Returns:
// - A boolean indicating whether the table exists in the database
// - An error if querying the database fails
//
// The function expects the table to have timestamp (nanoseconds since epoch)
// and active (integer boolean) columns.
func readActivityLogTable(db *sql.DB, result *[]ActivityLog) (bool, error) {
	existsRows, err := db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name='activity_log';")
	if err != nil {
		return false, fmt.Errorf("failed to query existing tables: %w", err)
	}
	defer existsRows.Close()

	if !existsRows.Next() {
		return false, nil // Table does not exist
	}

	// Query all records from the activity_log table
	rows, err := db.Query("SELECT timestamp, active FROM activity_log ORDER BY timestamp")
	if err != nil {
		return true, fmt.Errorf("failed to query activity logs: %w", err)
	}
	defer rows.Close()

	// Iterate through the results
	for rows.Next() {
		var timestampNano int64
		var activeInt int

		// Scan row into variables
		if err := rows.Scan(&timestampNano, &activeInt); err != nil {
			return true, fmt.Errorf("failed to scan row: %w", err)
		}

		// Convert timestamp from nanoseconds to time.Time
		timestamp := time.Unix(0, timestampNano)

		// Convert integer to boolean
		active := activeInt != 0

		// Append to results
		*result = append(*result, ActivityLog{
			Timestamp: timestamp,
			Active:    active,
		})
	}

	// Check for errors from iterating over rows
	if err := rows.Err(); err != nil {
		return true, fmt.Errorf("error iterating rows: %w", err)
	}

	return true, nil
}

// readActiveChangesTable reads activity data from the 'ActiveChanges' table in a legacy SQLite database.
//
// This function checks if the 'ActiveChanges' table exists and extracts records if found.
// The data is processed in groups to handle complex temporal relationships between entries
// and deduplicate timestamp conflicts. Each valid entry is converted to the ActivityLog format
// and appended to the result slice.
//
// Parameters:
// - db: An open SQLite database connection
// - result: A pointer to the slice where ActivityLog entries will be appended
//
// Returns:
// - A boolean indicating whether the table exists in the database
// - An error if querying the database fails
//
// The function expects the table to have Time (nanoseconds since epoch),
// Active (integer boolean) and StartEnd (integer) columns.
func readActiveChangesTable(db *sql.DB, result *[]ActivityLog) (bool, error) {
	existsRows, err := db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name='ActiveChanges';")
	if err != nil {
		return false, fmt.Errorf("failed to query existing tables: %w", err)
	}
	defer existsRows.Close()

	if !existsRows.Next() {
		return false, nil // Table does not exist
	}

	// Query all records from the ActiveChanges table
	rows, err := db.Query("SELECT Time, Active, StartEnd FROM ActiveChanges ORDER BY Time ASC, Active DESC, StartEnd DESC")
	if err != nil {
		return true, fmt.Errorf("failed to query active changes: %w", err)
	}
	defer rows.Close()

	type ActiveChange struct {
		Timestamp time.Time
		Active    bool
		IsSystem  bool
	}

	var activeChanges [][]ActiveChange
	var activeChangesGroup []ActiveChange

	// Iterate through the results
	for rows.Next() {
		var timestampNano int64
		var activeInt int
		var systemInt int

		// Scan row into variables
		if err := rows.Scan(&timestampNano, &activeInt, &systemInt); err != nil {
			return true, fmt.Errorf("failed to scan row: %w", err)
		}

		entry := ActiveChange{
			Timestamp: time.Unix(0, timestampNano),
			Active:    activeInt != 0,
			IsSystem:  systemInt != 0,
		}

		if len(activeChangesGroup) > 0 && entry.Active && entry.IsSystem {
			activeChanges = append(activeChanges, activeChangesGroup)
			activeChangesGroup = nil
		}

		activeChangesGroup = append(activeChangesGroup, entry)
	}

	if len(activeChangesGroup) > 0 {
		activeChanges = append(activeChanges, activeChangesGroup)
	}

	// Check for errors from iterating over rows
	if err := rows.Err(); err != nil {
		return true, fmt.Errorf("error iterating rows: %w", err)
	}

	if len(activeChanges) == 0 {
		return true, nil // No active changes found
	}

	timestamps := make(map[int64]int)

	for x := 0; x < len(activeChanges); x++ {
		if len(activeChanges[x]) == 0 {
			continue
		}

		if x != len(activeChanges)-1 && activeChanges[x][len(activeChanges[x])-1].Active {
			activeChanges[x][len(activeChanges[x])-1].Active = false
		}

		group := make([]ActiveChange, 0, len(activeChanges[x]))

		for y := 0; y < len(activeChanges[x]); y++ {
			if len(group) == 0 && !activeChanges[x][y].Active {
				continue
			}

			if len(group) == 0 {
				group = append(group, activeChanges[x][y])
				continue
			}

			if group[len(group)-1].Active && activeChanges[x][y].Active {
				continue
			} else if !group[len(group)-1].Active && !activeChanges[x][y].Active {
				group[len(group)-1] = activeChanges[x][y]
			} else {
				group = append(group, activeChanges[x][y])
			}
		}

		for _, entry := range group {
			timestamps[entry.Timestamp.UnixMilli()]++
		}

		activeChanges[x] = group
	}

	for _, group := range activeChanges {
		for _, entry := range group {
			if timestamps[entry.Timestamp.UnixMilli()] > 1 {
				continue
			}

			*result = append(*result, ActivityLog{
				Timestamp: entry.Timestamp,
				Active:    entry.Active,
			})
		}
	}

	return true, nil
}

// importActivityLogs imports activity logs into the PocketBase work_clock collection.
//
// Parameters:
// - app: The PocketBase application instance
// - logs: A slice of ActivityLog objects to import
//
// Returns:
// - An error if finding the collection or saving any record fails
//
// This function performs the data mapping from the legacy ActivityLog format
// to the PocketBase work_clock collection schema, where:
// - ActivityLog.Timestamp -> work_clock.timestamp
// - ActivityLog.Active -> work_clock.clock_in
//
// It uses addManyWorkClockRecords to import the logs in a single transaction,
// ensuring data consistency and proper validation of the clock in/out sequence.
// All logs are processed as a single unit, and the transaction will roll back
// if any record violates the validation rules.
func importActivityLogs(app *pocketbase.PocketBase, logs []ActivityLog) error {
	clockInTimestamps := make([]time.Time, 0, len(logs))
	clockOutTimestamps := make([]time.Time, 0, len(logs))

	for _, log := range logs {
		if log.Active {
			clockInTimestamps = append(clockInTimestamps, log.Timestamp)
		} else {
			clockOutTimestamps = append(clockOutTimestamps, log.Timestamp)
		}
	}

	if err := addManyWorkClockRecords(app, clockInTimestamps, clockOutTimestamps); err != nil {
		return fmt.Errorf("failed to add work clock records: %w", err)
	}

	return nil
}
