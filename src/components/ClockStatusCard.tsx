import LoadingIcon from "~icons/svg-spinners/bouncing-ball";
import ClockIcon from "~icons/tabler/clock";
import ClockInIcon from "~icons/tabler/clock-check";
import TimeIcon from "~icons/tabler/clock-hour-8";
import ClockOutIcon from "~icons/tabler/clock-pause";
import ClockPauseIcon from "~icons/tabler/player-pause";
import ClockPlayIcon from "~icons/tabler/player-play";

import { Component, Show } from "solid-js";

import { Effect } from "effect";

import { TimeStampEntry, addClockEntry } from "../services/workClock";
import { getRelativeTime } from "./TimeEntryUtils";

interface ClockStatusCardProps {
  isLoading: boolean;
  isClockedIn: boolean;
  lastAction: Date | null;
  currentSessionTime: string;
  todayTotalTime: string;
  onClockToggle: (newEntry: TimeStampEntry) => void;
}

/**
 * ClockStatusCard component
 *
 * Displays the current clock-in status and provides a button to clock in/out
 */
const ClockStatusCard: Component<ClockStatusCardProps> = (props) => {
  const toggleClock = () => {
    const now = new Date();
    const isCurrentlyClockedIn = props.isClockedIn;

    // Call PocketBase to add a new clock entry
    Effect.runPromise(addClockEntry(!isCurrentlyClockedIn, now))
      .then((newEntry) => {
        props.onClockToggle(newEntry);
      })
      .catch((error) => {
        console.error("Error toggling clock:", error);
      });
  };

  return (
    <div class="card bg-base-200 intersect:motion-preset-fade-in intersect-once mx-auto max-w-lg shadow-xl">
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
          <div class="stats mt-4 shadow">
            <div class="stat">
              <div class="stat-title">Status</div>
              <div
                class={`stat-value ${
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
                    Letzte Aktion: {getRelativeTime(props.lastAction.getTime())}
                  </>
                : "Keine kürzliche Aktivität"}
              </div>
            </div>

            <div class="stat">
              <div class="stat-title">Aktuelle Sitzung</div>
              <div
                class={`stat-value ${
                  props.isClockedIn ? "text-accent" : "text-base-content"
                }`}
              >
                {props.isClockedIn ? props.currentSessionTime : "-:--:--"}
              </div>
              <div class="stat-desc">
                <div class="badge badge-primary p-3 text-lg">
                  <TimeIcon class="mr-2" /> Heute gesamt: {props.todayTotalTime}
                </div>
              </div>
            </div>
          </div>
          <div class="card-actions mt-2 justify-center">
            <button
              onClick={toggleClock}
              class={`btn btn-lg ${
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
