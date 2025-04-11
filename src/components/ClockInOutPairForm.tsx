import LoadingIcon from "~icons/svg-spinners/bouncing-ball";
import AlertCircleIcon from "~icons/tabler/alert-circle";
import CalendarIcon from "~icons/tabler/calendar";
import CheckIcon from "~icons/tabler/check";
import ClockIcon from "~icons/tabler/clock";
import ClockInIcon from "~icons/tabler/clock-check";
import ClockOutIcon from "~icons/tabler/clock-pause";
import InfoCircleIcon from "~icons/tabler/info-circle";

import { Component, Show, createSignal } from "solid-js";

import { Effect } from "effect";

import { stringifyError } from "../services/pocketBase/pocketBase";
import { addClockInOutPair } from "../services/workClock";

/**
 * DateTimePicker Component
 * A reusable component for picking date and time
 */
const DateTimePicker: Component<{
  label: string;
  date: Date;
  onDateChange: (date: Date) => void;
}> = (props) => {
  // Format a date object for display in the date input field (YYYY-MM-DD)
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  // Format a date object for display in the time input field (HH:MM)
  const formatTimeForInput = (date: Date): string => {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  // Update the date portion of a datetime while preserving the time
  const updateDate = (currentDateTime: Date, newDateStr: string): void => {
    const newDate = new Date(newDateStr);
    const updatedDateTime = new Date(currentDateTime);
    updatedDateTime.setFullYear(newDate.getFullYear());
    updatedDateTime.setMonth(newDate.getMonth());
    updatedDateTime.setDate(newDate.getDate());
    props.onDateChange(updatedDateTime);
  };

  // Update the time portion of a datetime while preserving the date
  const updateTime = (currentDateTime: Date, timeStr: string): void => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const updatedDateTime = new Date(currentDateTime);
    updatedDateTime.setHours(hours);
    updatedDateTime.setMinutes(minutes);
    updatedDateTime.setSeconds(0);
    props.onDateChange(updatedDateTime);
  };

  return (
    <>
      {/* Date Picker */}
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text">Datum</span>
        </label>
        <div class="join">
          <input
            type="date"
            class="input input-bordered join-item flex-1"
            value={formatDateForInput(props.date)}
            onChange={(e) => updateDate(props.date, e.currentTarget.value)}
          />
          <button
            type="button"
            class="btn btn-square join-item"
            onClick={() => props.onDateChange(new Date())}
            title="Aktuelles Datum"
          >
            <CalendarIcon />
          </button>
        </div>
      </div>

      {/* Time Picker */}
      <div class="form-control">
        <label class="label">
          <span class="label-text">Uhrzeit</span>
        </label>
        <div class="join">
          <input
            type="time"
            class="input input-bordered join-item flex-1"
            value={formatTimeForInput(props.date)}
            onChange={(e) => updateTime(props.date, e.currentTarget.value)}
          />
          <button
            type="button"
            class="btn btn-square join-item"
            onClick={() => {
              const now = new Date();
              updateTime(
                props.date,
                `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
              );
            }}
            title="Aktuelle Uhrzeit"
          >
            <ClockIcon />
          </button>
        </div>
      </div>
    </>
  );
};

/**
 * TimePairStatus Component
 * Displays the summary of the selected time pair
 */
const TimePairStatus: Component<{
  clockInDate: Date;
  clockOutDate: Date;
}> = (props) => {
  // Determines if clock-in is before clock-out (work time) or after (absent time)
  const isWorkTime = (): boolean => {
    return props.clockInDate.getTime() <= props.clockOutDate.getTime();
  };

  // Calculates the duration between clock-in and clock-out
  const getDuration = (): string => {
    const diff = Math.abs(
      props.clockOutDate.getTime() - props.clockInDate.getTime(),
    );
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div class="stats bg-base-300 shadow">
      <div class="stat">
        <div class="stat-title">Typ</div>
        <div
          class={`stat-value text-lg ${isWorkTime() ? "text-primary" : "text-accent"}`}
        >
          {isWorkTime() ? "Arbeitszeit" : "Abwesenheit"}
        </div>
        <div class="stat-desc">
          {isWorkTime() ? "Ein- vor Ausstempelung" : "Aus- vor Einstempelung"}
        </div>
      </div>

      <div class="stat">
        <div class="stat-title">Dauer</div>
        <div class="stat-value text-lg">{getDuration()}</div>
        <div class="stat-desc">
          {props.clockInDate.toLocaleString("de-DE", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
          {" - "}
          {props.clockOutDate.toLocaleString("de-DE", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * ActionButtons Component
 * Form submission and reset buttons
 */
const ActionButtons: Component<{
  isSubmitting: boolean;
  onReset: () => void;
}> = (props) => {
  return (
    <div class="flex justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        onClick={() => props.onReset()}
        disabled={props.isSubmitting}
      >
        Zurücksetzen
      </button>
      <button
        type="submit"
        class="btn btn-primary"
        disabled={props.isSubmitting}
      >
        {props.isSubmitting ?
          <>
            <LoadingIcon class="mr-2" /> Wird hinzugefügt...
          </>
        : <>
            <CheckIcon class="mr-2" /> Zeitpaar hinzufügen
          </>
        }
      </button>
    </div>
  );
};

/**
 * ClockInOutPairForm Component
 *
 * A form for creating a clock-in/clock-out pair with specific timestamps.
 * This component allows users to manually add work time or absent time
 * by selecting dates and times for both clock-in and clock-out events.
 */
const ClockInOutPairForm: Component = () => {
  // Initialize with current date/time as default values
  const now = new Date();
  const [clockInDate, setClockInDate] = createSignal<Date>(now);
  const [clockOutDate, setClockOutDate] = createSignal<Date>(now);

  // Success and error state
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [submitResult, setSubmitResult] = createSignal<{
    success: boolean;
    message: string;
  } | null>(null);

  // Determines if clock-in is before clock-out (work time) or after (absent time)
  const isWorkTime = (): boolean => {
    return clockInDate().getTime() <= clockOutDate().getTime();
  };

  /**
   * Handles submission of the form
   */
  const handleSubmit = (e: Event) => {
    e.preventDefault();

    setIsSubmitting(true);
    setSubmitResult(null);

    Effect.runPromise(addClockInOutPair(clockInDate(), clockOutDate()))
      .then(() => {
        setSubmitResult({
          success: true,
          message: "Zeiteinträge erfolgreich erstellt.",
        });
      })
      .catch((error) => {
        setSubmitResult({
          success: false,
          message:
            stringifyError(error) ?? "Fehler beim Erstellen der Zeiteinträge.",
        });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  /**
   * Resets the form to current date/time
   */
  const resetForm = () => {
    const currentTime = new Date();
    setClockInDate(currentTime);
    setClockOutDate(currentTime);
    setSubmitResult(null);
  };

  return (
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">
          <ClockIcon class="mr-2" /> Zeitpaar hinzufügen
        </h2>

        <p class="mt-2 text-sm">
          <InfoCircleIcon class="mr-2 inline-block" />
          Wähle Datum und Zeit für Ein- und Ausstempelung, um ein Zeitpaar
          manuell zu erstellen.
          {isWorkTime() ?
            " (Arbeitszeit: Einstempelung vor Ausstempelung)"
          : " (Abwesenheit: Ausstempelung vor Einstempelung)"}
        </p>

        <form
          onSubmit={handleSubmit}
          class="mt-4"
        >
          <div class="grid gap-6 md:grid-cols-2">
            {/* Clock In Section */}
            <div class="bg-base-300 rounded-lg p-4">
              <h3 class="mb-3 flex items-center text-lg font-semibold">
                <ClockInIcon class="mr-2" /> Einstempelung
              </h3>
              <DateTimePicker
                label="Einstempelung"
                date={clockInDate()}
                onDateChange={setClockInDate}
              />
            </div>

            {/* Clock Out Section */}
            <div class="bg-base-300 rounded-lg p-4">
              <h3 class="mb-3 flex items-center text-lg font-semibold">
                <ClockOutIcon class="mr-2" /> Ausstempelung
              </h3>
              <DateTimePicker
                label="Ausstempelung"
                date={clockOutDate()}
                onDateChange={setClockOutDate}
              />
            </div>
          </div>

          {/* Summary and Actions */}
          <div class="mt-6 flex flex-col gap-4">
            <TimePairStatus
              clockInDate={clockInDate()}
              clockOutDate={clockOutDate()}
            />

            {/* Results Alert */}
            <Show when={submitResult() !== null}>
              <div
                class={`alert ${(submitResult()?.success ?? false) ? "alert-success" : "alert-error"}`}
              >
                {(submitResult()?.success ?? false) ?
                  <CheckIcon />
                : <AlertCircleIcon />}
                <span>{submitResult()?.message}</span>
              </div>
            </Show>

            <ActionButtons
              isSubmitting={isSubmitting()}
              onReset={resetForm}
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClockInOutPairForm;
