/**
 * Default Superuser Creation Migration
 *
 * This migration creates the initial administrator account in PocketBase.
 * It is assigned the priority 0 (filename starts with 0_) to ensure it runs before all
 * other migrations during application initialization.
 *
 * The migration performs the following steps:
 * 1. Finds the superusers collection in PocketBase
 * 2. Creates a new superuser with the predefined email address
 * 3. Generates a random password for this account
 * 4. Saves the newly created superuser to the database
 *
 * Note: For production environments, consider modifying this code to use specific
 * credentials rather than a random password for better security management.
 */
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// InitialAdminEmail defines the email address used for the default superuser account
const InitialAdminEmail = "__initial_superuser@example.com"

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
		if err != nil {
			return err
		}
		user := core.NewRecord(collection)

		user.SetEmail(InitialAdminEmail)
		user.SetRandomPassword()

		return app.Save(user)
	}, nil)
}
