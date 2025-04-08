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
			return handleLegacyImportPost(app, e.Request, e.Response)
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
func handleLegacyImportPost(app *pocketbase.PocketBase, req *http.Request, resp http.ResponseWriter) error {
	// Max upload size of 50MB
	const maxUploadSize = 50 * 1024 * 1024
	req.Body = http.MaxBytesReader(resp, req.Body, maxUploadSize)

	// Parse the multipart form (max 50MB in memory)
	if err := req.ParseMultipartForm(maxUploadSize); err != nil {
		resp.WriteHeader(http.StatusBadRequest)
		resp.Write([]byte("File too large or invalid multipart form"))
		return err
	}

	// Get the uploaded file
	file, header, err := req.FormFile("database")
	if err != nil {
		resp.WriteHeader(http.StatusBadRequest)
		resp.Write([]byte("Failed to get uploaded file"))
		return err
	}
	defer file.Close()

	// Check file extension (optional, can be removed if any file type is acceptable)
	if filepath.Ext(header.Filename) != ".db" {
		resp.WriteHeader(http.StatusBadRequest)
		resp.Write([]byte("Only .db files are allowed"))
		return fmt.Errorf("invalid file extension: %s", filepath.Ext(header.Filename))
	}

	// Create a temporary directory
	tempDir, err := os.MkdirTemp("", "legacy_import_*")
	if err != nil {
		resp.WriteHeader(http.StatusInternalServerError)
		resp.Write([]byte("Failed to create temporary directory"))
		return err
	}

	// Create a new file in the temp directory
	tempFilePath := filepath.Join(tempDir, header.Filename)
	tempFile, err := os.Create(tempFilePath)
	if err != nil {
		resp.WriteHeader(http.StatusInternalServerError)
		resp.Write([]byte("Failed to create temporary file"))
		return err
	}
	defer os.Remove(tempFilePath) // Clean up the temp file after processing
	defer tempFile.Close()

	// Copy the uploaded file to the temporary file
	_, err = io.Copy(tempFile, file)
	if err != nil {
		resp.WriteHeader(http.StatusInternalServerError)
		resp.Write([]byte("Failed to save uploaded file"))
		return err
	}

	// Read activity logs from the database
	activityLogs, err := readActivityLogs(tempFilePath)
	if err != nil {
		resp.WriteHeader(http.StatusInternalServerError)
		resp.Write([]byte(fmt.Sprintf("Failed to read activity logs: %v", err)))
		return err
	}

	// Import activity logs into the PocketBase collection
	err = importActivityLogs(app, activityLogs)
	if err != nil {
		resp.WriteHeader(http.StatusInternalServerError)
		resp.Write([]byte(fmt.Sprintf("Failed to import activity logs: %v", err)))
		return err
	}

	// Convert activity logs to JSON and return
	respData := map[string]interface{}{
		"success": true,
		"message": "File uploaded and processed successfully",
	}

	jsonResp, err := json.Marshal(respData)
	if err != nil {
		resp.WriteHeader(http.StatusInternalServerError)
		resp.Write([]byte("Failed to generate response"))
		return err
	}

	resp.Header().Set("Content-Type", "application/json")
	resp.WriteHeader(http.StatusOK)
	resp.Write(jsonResp)

	return nil
}

// readActivityLogs reads activity logs from a SQLite database file.
//
// Parameters:
// - dbPath: Path to the SQLite database file
//
// Returns:
// - A slice of ActivityLog objects containing the extracted log data
// - An error if the database could not be opened or queried
//
// The function expects the source database to have an activity_log table
// with timestamp (nanoseconds since epoch) and active (integer boolean) columns.
func readActivityLogs(dbPath string) ([]ActivityLog, error) {
	// Open the SQLite database
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	// Query all records from the activity_log table
	rows, err := db.Query("SELECT timestamp, active FROM activity_log ORDER BY timestamp")
	if err != nil {
		return nil, fmt.Errorf("failed to query activity logs: %w", err)
	}
	defer rows.Close()

	var activityLogs []ActivityLog

	// Iterate through the results
	for rows.Next() {
		var timestampNano int64
		var activeInt int

		// Scan row into variables
		if err := rows.Scan(&timestampNano, &activeInt); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		// Convert timestamp from nanoseconds to time.Time
		timestamp := time.Unix(0, timestampNano)

		// Convert integer to boolean
		active := activeInt != 0

		// Append to results
		activityLogs = append(activityLogs, ActivityLog{
			Timestamp: timestamp,
			Active:    active,
		})
	}

	// Check for errors from iterating over rows
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return activityLogs, nil
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
