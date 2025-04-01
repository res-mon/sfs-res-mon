import CalendarPlusIcon from "~icons/tabler/calendar-plus";
import ClockIcon from "~icons/tabler/clock";
import ClockPlayIcon from "~icons/tabler/player-play";

import { Component, For, Show } from "solid-js";

import {
  DailyRecord,
  TimeEntryPair,
  formatClockOutDate,
  formatDateForDisplay,
  formatTimeForDisplay,
} from "./TimeEntryUtils";

interface DailyRecordRowProps {
  record: DailyRecord;
  isOpen: boolean;
  toggleOpen: (date: string) => void;
}

/**
 * DailyRecordRow component
 *
 * Displays a single day's record in the time entry table with expandable details
 */
const DailyRecordRow: Component<DailyRecordRowProps> = (props) => {
  return (
    <>
      <tr
        class="hover:bg-base-300 cursor-pointer"
        onClick={() => props.toggleOpen(props.record.date)}
      >
        <td class="font-medium">{formatDateForDisplay(props.record.date)}</td>
        <td>{props.record.formattedTotal}</td>
        <td class="text-right">
          {props.record.entryPairs.length}{" "}
          {props.record.entryPairs.length === 1 ? "entry" : "entries"}
          {/* Show indicator if any entries cross midnight */}
          {props.record.entryPairs.some((pair) => pair.dayBoundary) ?
            <span
              class="tooltip tooltip-left ml-2"
              data-tip="Contains entries crossing midnight"
            >
              <CalendarPlusIcon class="text-accent inline-block" />
            </span>
          : null}
          {/* Show indicator for days with missing entries */}
          {props.record.hasMissingEntries ?
            <span
              class="tooltip tooltip-left ml-2"
              data-tip="Contains missing clock-in/out entries"
            >
              <ClockIcon class="text-warning inline-block" />
            </span>
          : null}
          {/* Show indicator for active sessions */}
          {props.record.isActive ?
            <span
              class="tooltip tooltip-left ml-2"
              data-tip="Currently active session"
            >
              <ClockPlayIcon class="text-success inline-block" />
            </span>
          : null}
        </td>
      </tr>
      <Show when={props.isOpen}>
        <tr>
          <td
            colSpan={3}
            class="p-0"
          >
            <div class="overflow-hidden">
              <table class="table-compact table w-full">
                <thead>
                  <tr>
                    <th>
                      <ClockIcon class="mr-1 inline-block" /> Clock In
                    </th>
                    <th>
                      <ClockIcon class="mr-1 inline-block" /> Clock Out
                    </th>
                    <th>
                      <ClockIcon class="mr-1 inline-block" /> Duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={props.record.entryPairs}>
                    {(pair) => <EntryPairRow pair={pair} />}
                  </For>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      </Show>
    </>
  );
};

interface EntryPairRowProps {
  pair: TimeEntryPair;
}

/**
 * EntryPairRow component
 *
 * Displays a single clock in/out pair within a day record
 */
const EntryPairRow: Component<EntryPairRowProps> = (props) => {
  return (
    <tr class={props.pair.dayBoundary ? "bg-accent bg-opacity-10" : ""}>
      <td>
        {props.pair.clockIn != null ?
          formatTimeForDisplay(props.pair.clockIn)
        : "Missing"}
      </td>
      <td>
        {props.pair.clockOut != null ?
          formatClockOutDate(
            props.pair.clockOut,
            props.pair.clockIn ?? props.pair.clockOut,
          )
        : props.pair.missingEntry ?
          "Missing"
        : "Still clocked in"}
        {props.pair.dayBoundary && (
          <span
            class="tooltip tooltip-right ml-2"
            data-tip="This entry crosses midnight"
          >
            <CalendarPlusIcon class="text-accent inline-block" />
          </span>
        )}
      </td>
      <td>
        {props.pair.missingEntry ?
          "Unknown"
        : formatTimeForDisplay(props.pair.duration)}
      </td>
    </tr>
  );
};

export default DailyRecordRow;
