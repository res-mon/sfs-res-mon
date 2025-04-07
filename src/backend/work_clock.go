// Work Clock Module for PocketBase
//
// This module provides functionality to track work hours by implementing clock-in and clock-out
// operations. It exposes API endpoints to manage the clock state, including clocking in,
// clocking out, and toggling the current state.
//
// The module ensures thread-safety when modifying clock status and prevents invalid state
// transitions (such as clocking in when already clocked in).
package backend

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// workClockMutex provides thread-safety for clock operations to prevent race conditions
// when multiple requests attempt to modify the clock state simultaneously.
var workClockMutex = sync.Mutex{}

// RegisterWorkClockAPI registers the work clock API endpoints with the PocketBase server.
// It creates multiple routes for managing clock state:
// - POST /api/work_clock - Accepts form data to clock in or out
// - GET /api/work_clock/clock_in - Clocks in the user
// - GET /api/work_clock/clock_out - Clocks out the user
// - GET /api/work_clock/toggle - Toggles between clock in and clock out states
func RegisterWorkClockAPI(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/work_clock", func(e *core.RequestEvent) error {
			clockIn := e.Request.FormValue("clock_in")

			switch clockIn {
			case "true", "false":
				if err := clockInOut(app, clockIn == "true"); err != nil {
					return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to clock in/out: %v", err), err)
				}
				return nil
			default:
				return e.Error(http.StatusBadRequest, "Invalid clock_in value. Expected 'true' or 'false'.", nil)
			}
		})

		se.Router.GET("/api/work_clock/clock_in", func(e *core.RequestEvent) error {
			if err := clockInOut(app, true); err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to clock in: %v", err), err)
			}
			return nil
		})
		se.Router.GET("/api/work_clock/clock_out", func(e *core.RequestEvent) error {
			if err := clockInOut(app, false); err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to clock out: %v", err), err)
			}
			return nil
		})

		se.Router.GET("/api/work_clock/toggle", func(e *core.RequestEvent) error {
			clockedIn, err := isCurrentlyClockedIn(app)
			if err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to check current clock status: %v", err), err)
			}

			if err := clockInOut(app, !clockedIn); err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to toggle clock status: %v", err), err)
			}
			return nil
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
