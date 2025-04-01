import CalendarIcon from "~icons/tabler/calendar";
import ClockIcon from "~icons/tabler/clock";
import TimeIcon from "~icons/tabler/clock-hour-8";
import TableIcon from "~icons/tabler/table";

import { Component, For, Show, createSignal } from "solid-js";

import DailyRecordRow from "./DailyRecordRow";
import { DailyRecord } from "./TimeEntryUtils";

interface TimeEntryTableProps {
  dailyRecords: DailyRecord[];
}

/**
 * TimeEntryTable component
 *
 * Displays a table of work time entries grouped by day
 */
const TimeEntryTable: Component<TimeEntryTableProps> = (props) => {
  // Track which day records are open in the UI
  const [openDayRecords, setOpenDayRecords] = createSignal<
    Record<string, boolean>
  >({});

  // Toggle a day record's open/closed state
  const toggleDayRecord = (date: string) => {
    setOpenDayRecords((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  // Check if a day record is open
  const isDayRecordOpen = (date: string) => {
    return !!openDayRecords()[date];
  };

  return (
    <Show when={props.dailyRecords.length > 0}>
      <div class="card bg-base-200 intersect:motion-preset-fade-in intersect-once mx-auto max-w-4xl shadow-xl">
        <div class="card-body">
          <h2 class="card-title">
            <TableIcon class="mr-2" /> Arbeitszeiten
          </h2>
          <div class="overflow-x-auto">
            <table class="table-zebra table w-full">
              <thead>
                <tr>
                  <th>
                    <CalendarIcon class="mr-1 inline-block" /> Datum
                  </th>
                  <th>
                    <TimeIcon class="mr-1 inline-block" /> Stunden
                  </th>
                  <th class="text-right">
                    <ClockIcon class="mr-1 inline-block" /> Einträge
                  </th>
                </tr>
              </thead>
              <tbody>
                <For each={props.dailyRecords}>
                  {(record) => (
                    <DailyRecordRow
                      record={record}
                      isOpen={isDayRecordOpen(record.date)}
                      toggleOpen={toggleDayRecord}
                    />
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default TimeEntryTable;
