// Package backend implements the server-side user management API for the sfs-res-mon application.
// It handles initial setup for user accounts via API endpoints and ensures the first user
// creation process is performed safely and atomically.
package backend

import (
	"fmt"
	"net/http"
	"sync"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/yerTools/simple-frontend-stack/src/backend/migrations"
)

// userMutex serializes access to user existence checks and creation endpoints
// to prevent race conditions during the initial user setup.
var userMutex = sync.Mutex{}

// RegisterUserAPI registers the user management API endpoints with the PocketBase server.
// It attaches two HTTP routes:
// - GET  /api/user/exists  : Determines if any user accounts beyond the default exist.
// - POST /api/user/create  : Creates the first normal user and matching superuser when none exist.
//
// GET /api/user/exists responses:
//
//	200 OK   - {"exists":true} if at least one user exists or the superuser state is non-default.
//	            {"exists":false} if no users and only the initial default superuser remain.
//	500 Error - On database count or fetch failures.
//
// POST /api/user/create expected form parameters:
//
//	email           (string) Required. Valid email for new accounts.
//	password        (string) Required. Minimum 10 characters.
//	passwordConfirm (string) Required. Must match 'password'.
//
// Responses:
//
//	200 OK    - {"success":true} on successful account creation.
//	400 Bad Request - Missing/invalid parameters or password mismatch/length issues.
//	409 Conflict    - When users already exist or unexpected superuser state.
//	500 Error       - On database operation failures or transaction rollbacks.
func RegisterUserAPI(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Handler: GET /api/user/exists
		// Purpose: Checks whether any user accounts exist beyond the default migration-created superuser.
		// Responses:
		//   200: {"exists": true} if users exist or superuser state is not default.
		//         {"exists": false} if no users and only default superuser present.
		//   500: Internal server error on database access failures.
		se.Router.GET("/api/user/exists", func(e *core.RequestEvent) error {
			userMutex.Lock()
			defer userMutex.Unlock()

			totalUsers, err := app.CountRecords("users")
			if err != nil {
				return e.Error(
					http.StatusInternalServerError,
					fmt.Sprintf(
						"Failed to count 'users' records for existence check: %v. Please verify database connectivity and collection state.",
						err,
					),
					err,
				)
			}

			if totalUsers > 0 {
				return e.JSON(200, map[string]bool{"exists": true})
			}

			superusers, err := app.FindAllRecords(core.CollectionNameSuperusers)
			if err != nil {
				return e.Error(
					http.StatusInternalServerError,
					fmt.Sprintf(
						"Failed to fetch '%s' records for existence check: %v. Ensure the superusers collection exists and check database access.",
						core.CollectionNameSuperusers,
						err,
					),
					err,
				)
			}

			if len(superusers) != 1 || superusers[0].GetString("email") != migrations.InitialAdminEmail {
				return e.JSON(200, map[string]bool{"exists": true})
			}

			return e.JSON(200, map[string]bool{"exists": false})
		})

		// Handler: POST /api/user/create
		// Purpose: Initializes the first normal user and a matching superuser when no users exist.
		// Parameters (form):
		//   - email           string (required): email address for new accounts.
		//   - password        string (required): password for new accounts (min length 10).
		//   - passwordConfirm string (required): must match 'password'.
		// Responses:
		//   200: {"success": true} on successful creation.
		//   400: Bad request on missing or invalid parameters.
		//   409: Conflict if users already exist or superuser count mismatch.
		//   500: Internal error on database or transaction failures.
		se.Router.POST("/api/user/create", func(e *core.RequestEvent) error {
			userMutex.Lock()
			defer userMutex.Unlock()

			totalUsers, err := app.CountRecords("users")
			if err != nil {
				return e.Error(
					http.StatusInternalServerError,
					fmt.Sprintf(
						"Failed to count records in 'users' collection: %v. Please check database connection and collection name.",
						err,
					),
					err,
				)
			}
			if totalUsers > 0 {
				return e.Error(
					http.StatusConflict,
					fmt.Sprintf(
						"User creation endpoint can only be called when no users exist. Found %d existing users. Please remove all existing users and try again.",
						totalUsers,
					),
					nil,
				)
			}

			existingSuperusers, err := app.FindAllRecords(core.CollectionNameSuperusers)
			if err != nil {
				return e.Error(
					http.StatusInternalServerError,
					fmt.Sprintf(
						"Failed to retrieve records from '%s' collection: %v. Please ensure the superusers collection exists and database is reachable.",
						core.CollectionNameSuperusers,
						err,
					),
					err,
				)
			}
			if len(existingSuperusers) != 1 {
				return e.Error(
					http.StatusConflict,
					fmt.Sprintf(
						"Unexpected superuser count. Expected exactly 1 default superuser but found %d records. Please verify the superusers collection.",
						len(existingSuperusers),
					),
					nil,
				)
			}

			if existingSuperusers[0].GetString("email") != migrations.InitialAdminEmail {
				return e.Error(
					http.StatusInternalServerError,
					fmt.Sprintf(
						"Initial superuser email mismatch. Expected '%s' but found '%s'. Please check the initial migration settings.",
						migrations.InitialAdminEmail,
						existingSuperusers[0].GetString("email"),
					),
					nil,
				)
			}

			superusers, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
			if err != nil {
				return e.Error(
					http.StatusInternalServerError,
					fmt.Sprintf(
						"Failed to locate superusers collection metadata: %v. Please verify migrations have been applied and collection identifier is correct.",
						err,
					),
					err,
				)
			}

			users, err := app.FindCollectionByNameOrId("users")
			if err != nil {
				return e.Error(
					http.StatusInternalServerError,
					fmt.Sprintf(
						"Failed to locate users collection metadata: %v. Please verify migrations and collection identifier.",
						err,
					),
					err,
				)
			}

			email := e.Request.FormValue("email")
			if email == "" {
				return e.Error(
					http.StatusBadRequest,
					"Missing 'email' parameter. Please provide a valid email address for the new user.",
					nil,
				)
			}

			password := e.Request.FormValue("password")
			if password == "" {
				return e.Error(
					http.StatusBadRequest,
					"Missing 'password' parameter. Please provide a secure password for the new user (minimum length 10 characters).",
					nil,
				)
			}

			passwordConfirm := e.Request.FormValue("passwordConfirm")
			if passwordConfirm == "" {
				return e.Error(
					http.StatusBadRequest,
					"Missing 'passwordConfirm' parameter. Please confirm the password by providing the same value as 'password'.",
					nil,
				)
			}

			if password != passwordConfirm {
				return e.Error(
					http.StatusBadRequest,
					"Password and confirmation do not match. Please ensure both 'password' and 'passwordConfirm' values are identical.",
					nil,
				)
			}

			if len(password) < 10 {
				return e.Error(
					http.StatusBadRequest,
					fmt.Sprintf(
						"Password length must be at least 10 characters. Provided length: %d. Please choose a longer password for security.",
						len(password),
					),
					nil,
				)
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
				err = txApp.Save(normalUser)
				if err != nil {
					return fmt.Errorf("could not save user: %w", err)
				}

				err = txApp.Save(superUser)
				if err != nil {
					return fmt.Errorf("could not save super user: %w", err)
				}

				err = txApp.Delete(existingSuperusers[0])
				if err != nil {
					return fmt.Errorf("could not delete initial super user: %w", err)
				}

				return nil
			})
			if err != nil {
				return e.Error(
					http.StatusInternalServerError,
					fmt.Sprintf(
						"Failed to create user and superuser transactionally: %v. Ensure input data is valid and database is operational.",
						err,
					),
					err,
				)
			}

			return e.JSON(http.StatusOK, map[string]bool{"success": true})
		})

		return se.Next()
	})
}
