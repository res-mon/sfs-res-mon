import { createSignal } from "solid-js";

import { ClientResponseError } from "pocketbase";

import { Effect, pipe } from "effect";

import pb, { ResponseError } from "./pocketBase/pocketBase";

/**
 * Reactive signal tracking the current authenticated status.
 * Initialized with PocketBase authStore validity and updated on store changes.
 */
const [getAuthenticated, setAuthenticated] = createSignal(pb.authStore.isValid);

// Subscribe to PocketBase authStore changes to keep signal in sync
pb.authStore.onChange(() => {
  setAuthenticated(pb.authStore.isValid);
});

/**
 * Returns whether the user is currently authenticated.
 * Reads from the reactive signal that reflects PocketBase authStore validity.
 * @returns {boolean} true if a valid auth token is present, false otherwise.
 */
export function isAuthenticated(): boolean {
  const current = getAuthenticated();
  const actual = pb.authStore.isValid;
  if (current === actual) {
    return current;
  }
  setAuthenticated(actual);
  return actual;
}

/**
 * Error type for userExists API failures
 */
export type UserExistsError = ResponseError<"userExists"> & {
  innerError?: unknown;
};

/**
 * Calls the backend to determine if any user accounts exist.
 * GET /api/user/exists
 * @returns Effect that yields true if users exist, false if none, or fails with UserExistsError
 */
export function userExists(): Effect.Effect<boolean, UserExistsError> {
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch("/api/user/exists");
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }
      const data = (await res.json()) as { exists: boolean };
      return data.exists;
    },
    catch: (error) =>
      ({
        type: "userExists",
        message: `Failed to fetch user existence: ${error}`,
        innerError: error,
      }) as UserExistsError,
  });
}

/**
 * Error type for createUser API failures
 */
export type CreateUserError =
  | (ResponseError<"createUser"> & {
      innerError?: unknown;
    })
  | LoginError;

/**
 * Creates the first user account via POST /api/user/create
 * On success, logs the user in; on failure, yields a verbose error.
 * @param email - email address for the new user
 * @param password - password for the new user
 * @param passwordConfirm - must match the password
 * @returns Effect that yields true on success or fails with CreateUserError
 */
export function createUser(
  email: string,
  password: string,
  passwordConfirm: string,
): Effect.Effect<boolean, CreateUserError> {
  return pipe(
    Effect.tryPromise({
      try: async () => {
        const form = new FormData();
        form.append("email", email);
        form.append("password", password);
        form.append("passwordConfirm", passwordConfirm);

        const res = await fetch("/api/user/create", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Server returned ${res.status}: ${text}`);
        }
        return true;
      },
      catch: (error) =>
        ({
          type: "createUser",
          message: `Failed to create user: ${error}`,
          innerError: error,
        }) as CreateUserError,
    }),
    Effect.flatMap((res) => {
      if (!res) {
        return Effect.succeed(false);
      }

      return loginUser(email, password);
    }),
  );
}

/**
 * Error type for loginUser failures
 */
export type LoginError = ResponseError<"login"> & {
  innerError?: ClientResponseError | unknown;
};

/**
 * Authenticates as an existing user via PocketBase auth store.
 * @param email - email address of the user
 * @param password - password of the user
 * @returns Effect that yields true on successful login or fails with LoginError
 */
export function loginUser(
  email: string,
  password: string,
): Effect.Effect<boolean, LoginError> {
  return Effect.tryPromise({
    try: async () => {
      await pb.collection("users").authWithPassword(email, password);
      return true;
    },
    catch: (error) => {
      const inner = error instanceof ClientResponseError ? error : error;
      return {
        type: "login",
        message: `Failed to login user: ${error}`,
        innerError: inner,
      } as LoginError;
    },
  });
}
