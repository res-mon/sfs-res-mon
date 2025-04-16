/**
 * Users Collection Modification Migration
 *
 * This migration modifies the security rules for the built-in users collection
 * in PocketBase. It sets the CreateRule to nil, which restricts user creation
 * to superusers only (removing the ability for public user registration).
 *
 * This is an important security measure for applications where user accounts
 * should only be created by administrators.
 *
 * The migration includes:
 * 1. Finding the existing users collection
 * 2. Setting its CreateRule to nil (superuser only)
 * 3. Saving the modified collection back to the database
 */
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		collection.CreateRule = nil

		return app.Save(collection)
	}, nil)
}
