/**
 * Initial Database Schema Migration
 *
 * This migration establishes the foundational data structure for the work_clock collection
 * in PocketBase. It defines the schema for tracking time entries with timestamps and clock in/out status.
 *
 * This schema was created using the following command:
 * `go run . migrate create "initial schema"`
 *
 * The migration includes:
 * 1. Creation of the work_clock collection
 * 2. Definition of field structures with appropriate validation rules
 * 3. Setup of a unique index to prevent duplicate entries
 * 4. Implementation of both up and down migration functions
 */
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// ref is a generic helper function that returns a pointer to the provided value
// This is used throughout the migration to set pointer fields in the PocketBase schema
func ref[T any](value T) *T {
	return &value
}

func init() {
	m.Register(func(app core.App) error {
		// Migrate up - Creates the collection and its schema
		c := &core.Collection{}

		// Collection identification
		c.Id = "pbc_1743167663_01"
		c.Name = "work_clock"
		c.Type = "base"

		// Security rules
		// Empty strings mean no rules are applied (unrestricted)
		c.CreateRule = ref("") // Who can create records
		c.DeleteRule = ref("") // Who can delete records
		c.ListRule = ref("")   // Who can list/query records
		c.UpdateRule = ref("") // Who can update records
		c.ViewRule = ref("")   // Who can view individual records

		// Field definitions for the work_clock collection
		c.Fields = []core.Field{
			// Primary key field - Automatically generated ID
			&core.TextField{
				// System field settings
				PrimaryKey: true, // This is the primary key field
				System:     true, // Field is managed by the system

				// Visibility and requirements
				Hidden:      false, // Field is visible in the Admin UI
				Presentable: false, // Not used as a display field
				Required:    true,  // Field is required

				// Field identification
				Id:   "field_1743167663_01_a",
				Name: "id",

				// Validation rules
				AutogeneratePattern: "[a-z0-9]{15}", // Pattern for auto-generated IDs
				Min:                 15,             // Minimum length of 15 characters
				Max:                 15,             // Maximum length of 15 characters
				Pattern:             "^[a-z0-9]+$",  // Only lowercase alphanumeric
			},
			// Timestamp field - Stores the date/time of the clock event
			&core.DateField{
				// System field settings
				System: false, // Not managed by the system

				// Visibility and requirements
				Hidden:      false, // Field is visible in the Admin UI
				Presentable: true,  // Used as a display field
				Required:    true,  // Field is required

				// Field identification
				Id:   "field_1743167663_01_b",
				Name: "timestamp",

				// Date constraints (no min/max restrictions)
				Min: types.DateTime{},
				Max: types.DateTime{},
			},
			// Clock_in field - Boolean indicating if this is a clock-in or clock-out event
			&core.BoolField{
				// System field settings
				System: false, // Not managed by the system

				// Visibility and requirements
				Hidden:      false, // Field is visible in the Admin UI
				Presentable: true,  // Used as a display field
				Required:    false, // Field is optional (defaults to false)

				// Field identification
				Id:   "field_1743167663_01_c",
				Name: "clock_in", // true for clock-in, false for clock-out
			},
		}

		// Database indexes for query optimization and data integrity
		c.Indexes = []string{
			// Create a unique index to prevent duplicate entries
			// This ensures that there cannot be multiple entries with the same timestamp and clock_in status
			"CREATE UNIQUE INDEX " +
				"`idx_1743167663_01_a` " +
				"ON `work_clock` " +
				"(`timestamp`," +
				"`clock_in`)",
		}

		// Save the collection to the database
		return app.Save(c)
	}, func(app core.App) error {
		// Migrate down - Removes the collection if the migration needs to be rolled back
		collection, err := app.FindCollectionByNameOrId("pbc_1743167663_01")
		if err != nil {
			return err
		}

		// Delete the collection and all its records
		return app.Delete(collection)
	})
}
