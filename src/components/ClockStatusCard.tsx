import LoadingIcon from "~icons/svg-spinners/bouncing-ball";
import ClockIcon from "~icons/tabler/clock";
import ClockInIcon from "~icons/tabler/clock-check";
import TimeIcon from "~icons/tabler/clock-hour-8";
import ClockOutIcon from "~icons/tabler/clock-pause";
import ClockPauseIcon from "~icons/tabler/player-pause";
import ClockPlayIcon from "~icons/tabler/player-play";

import { Component, Show } from "solid-js";

import { Effect } from "effect";

import { addClockEntry } from "../services/workClock";
import { getRelativeTime } from "./TimeEntryUtils";

/**
 * Props interface for the ClockStatusCard component
 *
 * @interface ClockStatusCardProps
 * @property {boolean} isLoading - Whether data is currently being loaded
 * @property {boolean} isClockedIn - Whether the user is currently clocked in
 * @property {Date | null} lastAction - Timestamp of the last clock action, or null if none
 * @property {string} currentSessionTime - Duration of the current session formatted as HH:MM:SS
 * @property {string} todayTotalTime - Total time worked today formatted as HH:MM:SS
 */
interface ClockStatusCardProps {
  isLoading: boolean;
  isClockedIn: boolean;
  lastAction: Date | null;
  currentSessionTime: string;
  todayTotalTime: string;
}

/**
 * ClockStatusCard component
 *
 * Displays the current clock-in status and provides controls for time tracking
 * This component:
 * 1. Shows the current clock-in/out status
 * 2. Displays real-time session duration when clocked in
 * 3. Shows the total time worked today
 * 4. Provides a button to toggle between clocked-in and clocked-out states
 * 5. Shows a loading state while data is being retrieved
 *
 * @param {ClockStatusCardProps} props - Properties for the component
 * @returns {JSX.Element} The rendered component
 */
const ClockStatusCard: Component<ClockStatusCardProps> = (props) => {
  /**
   * Toggles the current clock state between clocked in and clocked out
   * Creates a new time entry with the opposite state of the current one
   */
  const toggleClock = () => {
    const now = new Date();
    const isCurrentlyClockedIn = props.isClockedIn;

    // Call PocketBase to add a new clock entry
    Effect.runPromise(addClockEntry(!isCurrentlyClockedIn, now)).catch(
      (error) => {
        console.error("Error toggling clock:", error);
      },
    );
  };

  return (
    <div class="card bg-base-200 intersect:motion-preset-fade-in intersect-once mx-auto w-full shadow-xl">
      <div class="card-body">
        <Show
          when={!props.isLoading}
          fallback={
            <div class="flex flex-col items-center justify-center p-8">
              <LoadingIcon class="text-primary h-16 w-16" />
              <p class="mt-4 text-lg">Deine Zeitdaten werden geladen...</p>
            </div>
          }
        >
          <h2 class="card-title">
            <ClockIcon class="mr-2" /> Stempeluhr-Status
          </h2>
          <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="stats w-full shadow">
              <div class="stat">
                <div class="stat-title">Status</div>
                <div
                  class={`stat-value text-2xl sm:text-3xl ${
                    props.isClockedIn ? "text-success" : "text-error"
                  }`}
                >
                  {props.isClockedIn ?
                    <>
                      <ClockPlayIcon class="mr-1 inline-block" /> Eingestempelt
                    </>
                  : <>
                      <ClockPauseIcon class="mr-1 inline-block" /> Ausgestempelt
                    </>
                  }
                </div>
                <div class="stat-desc">
                  {props.lastAction ?
                    <>
                      {"Letzte Aktion: "}
                      {getRelativeTime(props.lastAction.getTime())}
                    </>
                  : "Keine kürzliche Aktivität"}
                </div>
              </div>
            </div>

            <div class="stats w-full shadow">
              <div class="stat">
                <div class="stat-title">Aktuelle Sitzung</div>
                <div
                  class={`stat-value text-2xl sm:text-3xl ${
                    props.isClockedIn ? "text-accent" : "text-base-content"
                  }`}
                >
                  {props.isClockedIn ? props.currentSessionTime : "-:--:--"}
                </div>
                <div class="stat-desc">
                  <div class="badge badge-primary p-2 text-sm sm:p-3 sm:text-lg">
                    <TimeIcon class="mr-1 sm:mr-2" />
                    {"Heute gesamt: "}
                    {props.todayTotalTime}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="card-actions mt-4 justify-center">
            <button
              onClick={toggleClock}
              class={`btn btn-md sm:btn-lg w-full sm:w-auto ${
                props.isClockedIn ? "btn-error" : "btn-success"
              }`}
            >
              {props.isClockedIn ?
                <>
                  <ClockOutIcon class="mr-2" /> Ausstempeln
                </>
              : <>
                  <ClockInIcon class="mr-2" /> Einstempeln
                </>
              }
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default ClockStatusCard;
