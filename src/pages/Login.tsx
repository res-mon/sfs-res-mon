import { Component, Show, createSignal, onMount } from "solid-js";

import { Navigate, useNavigate } from "@solidjs/router";
import { Effect } from "effect";

import { stringifyError } from "../services/pocketBase/pocketBase";
import {
  createUser,
  isAuthenticated,
  loginUser,
  userExists,
} from "../services/userApi";

const Login: Component = () => {
  const navigate = useNavigate();
  const [exists, setExists] = createSignal<boolean | null>(null);
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirm, setConfirm] = createSignal("");
  const [errorMsg, setErrorMsg] = createSignal("");

  onMount(async () => {
    try {
      const res = await Effect.runPromise(userExists());
      setExists(res);
    } catch (err: unknown) {
      setExists(true);
      setErrorMsg(
        "Fehler beim Überprüfen der Benutzerexistenz: " +
          (stringifyError(err) ?? ""),
      );
    }
  });

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      await Effect.runPromise(loginUser(email(), password()));
      navigate("/work-clock", { replace: true });
    } catch (err: unknown) {
      setErrorMsg("Anmeldung fehlgeschlagen: " + (stringifyError(err) ?? ""));
    }
  };

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    setErrorMsg("");
    if (password() !== confirm()) {
      setErrorMsg("Passwörter stimmen nicht überein.");
      return;
    }
    try {
      await Effect.runPromise(createUser(email(), password(), confirm()));
      navigate("/work-clock", { replace: true });
    } catch (err: unknown) {
      setErrorMsg(
        "Benutzererstellung fehlgeschlagen: " + (stringifyError(err) ?? ""),
      );
    }
  };

  return (
    <div class="bg-base-100 flex min-h-screen items-center justify-center p-4">
      <Show
        when={!isAuthenticated()}
        fallback={<Navigate href="/work-clock" />}
      >
        <Show
          when={exists() !== null}
          fallback={<div class="text-center">Lädt...</div>}
        >
          <div class="bg-base-200 card w-full max-w-md shadow-lg">
            <div class="card-body space-y-6">
              <h2 class="card-title text-center text-2xl">
                {exists() === true ? "Anmelden" : "Benutzer erstellen"}
              </h2>
              <Show when={errorMsg()}>
                <div class="alert alert-error">{errorMsg()}</div>
              </Show>
              <form
                onSubmit={(e) =>
                  exists() === true ? handleLogin(e) : handleCreate(e)
                }
                class="space-y-4"
              >
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text">E‑Mail</span>
                  </label>
                  <input
                    type="email"
                    class="input input-bordered w-full"
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    required
                  />
                </div>
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text">Passwort</span>
                  </label>
                  <input
                    type="password"
                    class="input input-bordered w-full"
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    required
                  />
                </div>
                <Show when={exists() === false}>
                  <div class="form-control w-full">
                    <label class="label">
                      <span class="label-text">Passwort bestätigen</span>
                    </label>
                    <input
                      type="password"
                      class="input input-bordered w-full"
                      value={confirm()}
                      onInput={(e) => setConfirm(e.currentTarget.value)}
                      required
                    />
                  </div>
                </Show>
                <button
                  type="submit"
                  class="btn btn-primary w-full"
                >
                  {exists() === true ? "Anmelden" : "Benutzer erstellen"}
                </button>
              </form>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default Login;
