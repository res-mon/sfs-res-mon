import LoadingIcon from "~icons/svg-spinners/bouncing-ball";
import CalendarIcon from "~icons/tabler/calendar";
// Import calendar with plus for day crossings
import CalendarPlusIcon from "~icons/tabler/calendar-plus";
import ClockIcon from "~icons/tabler/clock";
import ClockInIcon from "~icons/tabler/clock-check";
import TimeIcon from "~icons/tabler/clock-hour-8";
import ClockOutIcon from "~icons/tabler/clock-pause";
import ClockPauseIcon from "~icons/tabler/player-pause";
import ClockPlayIcon from "~icons/tabler/player-play";
import TableIcon from "~icons/tabler/table";

import {
  Component,
  For,
  JSX,
  Show,
  createEffect,
  createSignal,
  onMount,
} from "solid-js";

import { format, formatDistance } from "date-fns";
import { de } from "date-fns/locale";
import { Effect, Schedule, pipe } from "effect";

// Import types and functions from the sample data file
import {
  DailyRecord,
  TimeRecord,
  formatDuration,
  parseSampleData,
  processTimeRecords,
} from "../data/sampleTimeData";
import { addClockEntry } from "../services/workClock";
import { ObserverProvider } from "./Layout";

/**
 * CreateRandomStampings component
 *
 * A utility component that generates random clock-in and clock-out entries for testing purposes.
 * It creates 100 randomized timestamps within the past 90 days using Effect.js for concurrent execution.
 * Each timestamp has a 50% chance of being a clock-in or clock-out entry.
 *
 * @returns {JSX.Element} A styled component with a button to trigger random entry generation
 */
const CreateRandomStampings = () => {
  const [createdCount, setCreatedCount] = createSignal(0);
  const [isGenerating, setIsGenerating] = createSignal<[boolean, number]>([
    false,
    0,
  ]);

  const generatingDone = (error: unknown = undefined) => {
    setIsGenerating([false, createdCount()]);

    if (error != null) {
      console.error("Error creating random stamping:", error);
    }
  };

  const createRandomStampings = () => {
    setIsGenerating([true, createdCount()]);
    const now = new Date().getTime();
    const delta = 1000 * 60 * 60 * 24 * 90; // Delta up to 90 days

    const createPipeline = pipe(
      Effect.sync(() => ({
        clockIn: Math.random() < 0.5,
        timestamp: new Date(now - Math.floor(Math.random() * delta)),
      })),
      Effect.flatMap(({ clockIn, timestamp }) =>
        addClockEntry(clockIn, timestamp),
      ),
      Effect.mapBoth({
        onSuccess: () => setCreatedCount((prev) => prev + 1),
        onFailure: generatingDone,
      }),
    );

    const repeatPolicy = Schedule.addDelay(
      Schedule.recurs(99),
      () => "10 millis",
    );

    Effect.runPromise(Effect.repeat(createPipeline, repeatPolicy))
      .then(generatingDone)
      .catch(generatingDone);
  };

  return (
    <div class="mt-4 flex flex-col items-center gap-2">
      <button
        onClick={createRandomStampings}
        class="btn btn-sm btn-secondary"
        disabled={isGenerating()[0]}
      >
        {isGenerating()[0] ?
          <>
            <LoadingIcon class="mr-2 h-4 w-4" /> Generating...
          </>
        : "Create 100 Random Stampings"}
      </button>
      <div class="badge badge-outline">
        {isGenerating()[0] ?
          `Generating: ${createdCount() - isGenerating()[1]}/100 ...`
        : createdCount() > 0 ?
          `Created: ${createdCount()} random stampings.`
        : "You can generate random stampings."}
      </div>
    </div>
  );
};

const WorkClock: Component = (): JSX.Element => {
  // Store clock entries in localStorage
  const STORAGE_KEY = "work-clock-entries";

  // State for tracking clock status and entries
  const [isClockedIn, setIsClockedIn] = createSignal<boolean>(false);
  const [lastAction, setLastAction] = createSignal<Date | null>(null);
  const [timeRecords, setTimeRecords] = createSignal<TimeRecord[]>([]);
  const [dailyRecords, setDailyRecords] = createSignal<DailyRecord[]>([]);
  const [currentSessionTime, setCurrentSessionTime] =
    createSignal<string>("00:00:00");
  const [todayTotalTime, setTodayTotalTime] = createSignal<string>("00:00:00");
  const [isLoading, setIsLoading] = createSignal(true);
  const [_, setShowImportedData] = createSignal<boolean>(false);

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

  const processTimeRecord = (todayRecord: TimeRecord) => {
    const entries = todayRecord.entries;
    if (entries.length > 0 && entries[entries.length - 1].type === "clock-in") {
      setIsClockedIn(true);
      setLastAction(new Date(entries[entries.length - 1].timestamp));
    } else {
      setIsClockedIn(false);
      if (entries.length > 0) {
        setLastAction(new Date(entries[entries.length - 1].timestamp));
      }
    }
  };

  // Initialize from localStorage or sample data
  onMount(() => {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData != null) {
      const parsedData = JSON.parse(storedData) as TimeRecord[];
      setTimeRecords(parsedData);
      // Check if user is currently clocked in
      const today = new Date().toISOString().split("T")[0];
      const todayRecord = parsedData.find((record) => record.date === today);
      if (todayRecord) {
        processTimeRecord(todayRecord);
      }
      setDailyRecords(processTimeRecords(parsedData));
      setIsLoading(false);
    } else {
      // No data in localStorage, offer to use sample data
      setIsLoading(false);
    }
  });

  // Import sample data
  const importSampleData = () => {
    const sampleRecords = parseSampleData();
    setTimeRecords(sampleRecords);
    setDailyRecords(processTimeRecords(sampleRecords));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleRecords));
    setShowImportedData(true);
  };

  // Update current session time every second when clocked in
  createEffect(() => {
    if (!isClockedIn() || !lastAction()) return;
    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = now.getTime() - lastAction()!.getTime();
      setCurrentSessionTime(formatDuration(elapsed));
      // Update the work history data in real-time when clocked in
      setDailyRecords(processTimeRecords(timeRecords()));
    }, 1000);
    return () => clearInterval(interval);
  });

  // Calculate today's total time worked
  const calculateTodayTotalTime = () => {
    const today = new Date().toISOString().split("T")[0];
    const todayRecord = dailyRecords().find((record) => record.date === today);

    if (todayRecord) {
      setTodayTotalTime(todayRecord.formattedTotal);
    } else {
      setTodayTotalTime("00:00:00");
    }
  };

  // Update today's total time whenever daily records change
  createEffect(() => {
    calculateTodayTotalTime();
  });

  // Format clock out date when crossing days
  const formatClockOutDate = (timestamp: number, clockInTimestamp: number) => {
    const clockOutDate = new Date(timestamp);
    const clockInDate = new Date(clockInTimestamp);
    // Check if dates are different
    if (
      clockOutDate.getDate() !== clockInDate.getDate() ||
      clockOutDate.getMonth() !== clockInDate.getMonth() ||
      clockOutDate.getFullYear() !== clockInDate.getFullYear()
    ) {
      // Format with date for day crossings
      return format(clockOutDate, "d. MMM, HH:mm:ss", { locale: de });
    }
    // Just return time for same-day entries
    return format(clockOutDate, "HH:mm:ss");
  };

  const toggleClock = () => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const action = isClockedIn() ? "clock-out" : "clock-in";
    const updatedRecords = [...timeRecords()];
    const todayRecordIndex = updatedRecords.findIndex(
      (record) => record.date === today,
    );

    if (todayRecordIndex >= 0) {
      // Update existing record for today
      updatedRecords[todayRecordIndex].entries.push({
        type: action,
        timestamp: now.getTime(), // Using Unix timestamp in milliseconds
      });
    } else {
      // Create new record for today
      updatedRecords.push({
        date: today,
        entries: [
          {
            type: action,
            timestamp: now.getTime(), // Using Unix timestamp in milliseconds
          },
        ],
      });
    }

    // Update state and localStorage
    setTimeRecords(updatedRecords);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));

    // Update UI state
    setIsClockedIn(!isClockedIn());
    setLastAction(now);
    setDailyRecords(processTimeRecords(updatedRecords));
  };

  const formatTimeForDisplay = (timestamp: number) => {
    const date = new Date(timestamp);
    return format(date, "HH:mm:ss");
  };

  const formatDateForDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "EEEE, d. MMMM yyyy", { locale: de });
  };

  const getRelativeTime = (timestamp: number | null | undefined) => {
    if (timestamp == null) return "";
    return formatDistance(new Date(timestamp), new Date(), {
      addSuffix: true,
      locale: de,
    });
  };

  // Function to clear all data
  const clearAllData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setTimeRecords([]);
    setDailyRecords([]);
    setIsClockedIn(false);
    setLastAction(null);
    setShowImportedData(false);
  };

  return (
    <ObserverProvider>
      <div class="space-y-8">
        {/* Header Section */}
        <div class="text-center">
          <h1 class="intersect:motion-preset-slide-in-from-left intersect-once mb-4 text-4xl font-bold">
            <ClockIcon class="mr-2 inline-block" /> Work Clock
          </h1>
          <p class="intersect:motion-preset-slide-in-from-right intersect-once mx-auto max-w-3xl text-lg">
            Track your work time efficiently by clocking in and out. View your
            daily time records and total work hours.
          </p>
        </div>

        {/* Clock In/Out Section */}
        <div class="card bg-base-200 intersect:motion-preset-fade-in intersect-once mx-auto max-w-lg shadow-xl">
          <div class="card-body">
            <Show
              when={!isLoading()}
              fallback={
                <div class="flex flex-col items-center justify-center p-8">
                  <LoadingIcon class="text-primary h-16 w-16" />
                  <p class="mt-4 text-lg">Loading your time data...</p>
                </div>
              }
            >
              <h2 class="card-title flex items-center justify-center text-2xl">
                {isClockedIn() ?
                  <>
                    <ClockPauseIcon class="mr-2" /> Currently Working
                  </>
                : <>
                    <ClockPlayIcon class="mr-2" /> Not Working
                  </>
                }
              </h2>
              <div class="flex flex-col items-center justify-center p-4">
                <div class="text-4xl font-bold">
                  {isClockedIn() ? currentSessionTime() : "00:00:00"}
                </div>
                <p class="mt-2 text-sm opacity-80">
                  {lastAction() ?
                    `Last action: ${getRelativeTime(lastAction()?.getTime())}`
                  : "No recent activity"}
                </p>
                <div class="mt-4 flex items-center justify-center">
                  <div class="badge badge-primary p-3 text-lg">
                    <TimeIcon class="mr-2" /> Today's Total: {todayTotalTime()}
                  </div>
                </div>
              </div>
              <div class="card-actions mt-2 justify-center">
                <button
                  onClick={toggleClock}
                  class={`btn btn-lg ${
                    isClockedIn() ? "btn-error" : "btn-success"
                  }`}
                >
                  {isClockedIn() ?
                    <>
                      <ClockOutIcon class="mr-2" /> Clock Out
                    </>
                  : <>
                      <ClockInIcon class="mr-2" /> Clock In
                    </>
                  }
                </button>
              </div>
              <CreateRandomStampings />
            </Show>
          </div>
        </div>

        {/* Time History Section */}
        <Show when={dailyRecords().length > 0}>
          <div class="card bg-base-200 intersect:motion-preset-fade-in intersect-once mx-auto max-w-4xl shadow-xl">
            <div class="card-body">
              <h2 class="card-title">
                <TableIcon class="mr-2" /> Work History
              </h2>
              <div class="overflow-x-auto">
                <table class="table-zebra table w-full">
                  <thead>
                    <tr>
                      <th>
                        <CalendarIcon class="mr-1 inline-block" /> Date
                      </th>
                      <th>
                        <TimeIcon class="mr-1 inline-block" /> Hours
                      </th>
                      <th class="text-right">
                        <ClockIcon class="mr-1 inline-block" /> Entries
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={dailyRecords()}>
                      {(record) => (
                        <>
                          <tr
                            class="hover:bg-base-300 cursor-pointer"
                            onClick={() => toggleDayRecord(record.date)}
                          >
                            <td class="font-medium">
                              {formatDateForDisplay(record.date)}
                            </td>
                            <td>{record.formattedTotal}</td>
                            <td class="text-right">
                              {record.entryPairs.length}{" "}
                              {record.entryPairs.length === 1 ?
                                "entry"
                              : "entries"}
                              {/* Show indicator if any entries cross midnight */}
                              {(
                                record.entryPairs.some(
                                  (pair) => pair.dayBoundary,
                                )
                              ) ?
                                <span
                                  class="tooltip tooltip-left ml-2"
                                  data-tip="Contains entries crossing midnight"
                                >
                                  <CalendarPlusIcon class="text-accent inline-block" />
                                </span>
                              : null}
                            </td>
                          </tr>
                          <Show when={isDayRecordOpen(record.date)}>
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
                                          <ClockIcon class="mr-1 inline-block" />{" "}
                                          Clock In
                                        </th>
                                        <th>
                                          <ClockIcon class="mr-1 inline-block" />{" "}
                                          Clock Out
                                        </th>
                                        <th>
                                          <ClockIcon class="mr-1 inline-block" />{" "}
                                          Duration
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <For each={record.entryPairs}>
                                        {(pair) => (
                                          <tr
                                            class={
                                              pair.dayBoundary ?
                                                "bg-accent bg-opacity-10"
                                              : ""
                                            }
                                          >
                                            <td>
                                              {formatTimeForDisplay(
                                                pair.clockIn,
                                              )}
                                            </td>
                                            <td>
                                              {pair.clockOut != null ?
                                                formatClockOutDate(
                                                  pair.clockOut,
                                                  pair.clockIn,
                                                )
                                              : "Still clocked in"}
                                              {pair.dayBoundary && (
                                                <span
                                                  class="tooltip tooltip-right ml-2"
                                                  data-tip="This entry crosses midnight"
                                                >
                                                  <CalendarPlusIcon class="text-accent inline-block" />
                                                </span>
                                              )}
                                            </td>
                                            <td>
                                              {formatDuration(pair.duration)}
                                            </td>
                                          </tr>
                                        )}
                                      </For>
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          </Show>
                        </>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Show>

        {/* Import Sample Data Section */}
        <Show when={!isLoading() && timeRecords().length === 0}>
          <div class="text-center">
            <button
              onClick={importSampleData}
              class="btn btn-primary btn-lg mt-4"
            >
              Import Sample Data
            </button>
          </div>
        </Show>

        {/* Clear All Data Section */}
        <Show when={timeRecords().length > 0}>
          <div class="text-center">
            <button
              onClick={clearAllData}
              class="btn btn-error btn-lg mt-4"
            >
              Clear All Data
            </button>
          </div>
        </Show>
      </div>
    </ObserverProvider>
  );
};

export default WorkClock;
