// User Management Module for PocketBase
//
// This module provides functionality for managing users in the application. It handles
// the initialization of the first user account and offers endpoints to check if any users
// have been configured in the system.
//
// The module exposes two primary API endpoints:
// - GET /api/user/exists - Checks whether any user accounts exist in the system
// - POST /api/user/create - Creates the first user and corresponding superuser account
//
// The user creation process is designed to work only when no existing users are present,
// ensuring that the initial setup can only be performed once.
package backend

import (
	"fmt"
	"net/http"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/yerTools/simple-frontend-stack/src/backend/migrations"
)

// RegisterUserAPI registers the user management API endpoints with the PocketBase server.
// It creates two routes:
// - GET /api/user/exists - Returns whether any users exist in the system
// - POST /api/user/create - Creates the first user account if none exists
//
// The exists endpoint returns {"exists": true} if any users are present, and {"exists": false}
// if only the default admin user from migrations exists.
//
// The create endpoint validates that no users exist yet, then creates both a normal user
// and a superuser with the same credentials, replacing the default migration-created admin user.
//
// Parameters:
// - app: The PocketBase application instance
func RegisterUserAPI(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Handler for checking if any users exist
		se.Router.GET("/api/user/exists", func(e *core.RequestEvent) error {
			totalUsers, err := app.CountRecords("users")
			if err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Could not get records count: %v", err), err)
			}

			if totalUsers > 0 {
				return e.JSON(200, map[string]bool{"exists": true})
			}

			superusers, err := app.FindAllRecords(core.CollectionNameSuperusers)
			if err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Could not get superusers collection: %v", err), err)
			}

			if len(superusers) != 1 || superusers[0].GetString("email") != migrations.InitialAdminEmail {
				return e.JSON(200, map[string]bool{"exists": true})
			}

			return e.JSON(200, map[string]bool{"exists": false})
		})

		// Handler for creating the first user account
		// This endpoint should only work when no users exist yet
		se.Router.POST("/api/user/create", func(e *core.RequestEvent) error {
			totalUsers, err := app.CountRecords("users")
			if err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Could not get records count: %v", err), err)
			}
			if totalUsers > 0 {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Expected 0 users but found: %d", totalUsers), nil)
			}

			existingSuperusers, err := app.FindAllRecords(core.CollectionNameSuperusers)
			if err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Could not get superusers collection: %v", err), err)
			}
			if len(existingSuperusers) != 1 {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Expected exactly 1 super user but found: %d", len(existingSuperusers)), nil)
			}

			if existingSuperusers[0].GetString("email") != migrations.InitialAdminEmail {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Expected the initial email of '%s' but found another one", migrations.InitialAdminEmail), nil)
			}

			superusers, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
			if err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Could not find superusers collection: %v", err), err)
			}

			users, err := app.FindCollectionByNameOrId("users")
			if err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Could not find users collection: %v", err), err)
			}

			email := e.Request.FormValue("email")
			if email == "" {
				return e.Error(http.StatusBadRequest, "Missing 'email' (string) parameter", nil)
			}

			password := e.Request.FormValue("password")
			if password == "" {
				return e.Error(http.StatusBadRequest, "Missing 'password' (string) parameter", nil)
			}

			passwordConfirm := e.Request.FormValue("passwordConfirm")
			if passwordConfirm == "" {
				return e.Error(http.StatusBadRequest, "Missing 'passwordConfirm' (string) parameter", nil)
			}

			if password != passwordConfirm {
				return e.Error(http.StatusBadRequest, "Passwords do not match", nil)
			}

			if len(password) < 10 {
				return e.Error(http.StatusBadRequest, "Password length must be at least 10", nil)
			}

			normalUser := core.NewRecord(users)
			normalUser.SetEmail(email)
			normalUser.SetPassword(password)
			normalUser.SetEmailVisibility(false)
			normalUser.SetVerified(true)

			superUser := core.NewRecord(superusers)
			superUser.SetEmail(email)
			superUser.SetPassword(password)

			err = app.RunInTransaction(func(txApp core.App) error {
				err = app.Save(normalUser)
				if err != nil {
					return fmt.Errorf("could not save user: %w", err)
				}

				err = app.Save(superUser)
				if err != nil {
					return fmt.Errorf("could not save super user: %w", err)
				}

				err = app.Delete(existingSuperusers[0])
				if err != nil {
					return fmt.Errorf("could not delete initial super user: %w", err)
				}

				return nil
			})
			if err != nil {
				return e.Error(http.StatusInternalServerError, fmt.Sprintf("Could not create super user: %v", err), err)
			}

			return e.JSON(http.StatusOK, map[string]bool{"success": true})
		})

		return se.Next()
	})
}
