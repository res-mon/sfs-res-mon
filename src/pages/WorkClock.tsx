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

import LegacyImportPanel from "../components/LegacyImportPanel";
import {
  TimeStampEntry,
  addClockEntry,
  getTimeEntries,
} from "../services/workClock";
import { ObserverProvider } from "./Layout";

interface TimeEntryPair {
  clockIn: number | null;
  clockOut: number | null;
  duration: number; // Duration in milliseconds
  dayBoundary: boolean; // Flag to indicate if this entry crosses midnight
  missingEntry: boolean; // Flag to indicate if this entry is missing its pair
}

interface DailyRecord {
  date: string;
  entryPairs: TimeEntryPair[];
  totalTime: number; // total milliseconds
  formattedTotal: string; // formatted duration
  hasMissingEntries: boolean; // Flag to indicate if this day has missing entries
  isActive: boolean; // Flag to indicate if there is an active session on this day
}

function isSameLocalDay(a: Date | number, b: Date | number): boolean {
  if (typeof a === "number") {
    a = new Date(a);
  }
  if (typeof b === "number") {
    b = new Date(b);
  }

  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

// Format milliseconds into HH:MM:SS string
const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
};

function cleanupMiddleRecord(record: DailyRecord) {
  if (!record.isActive) {
    return;
  }

  record.hasMissingEntries = true;
  record.isActive = false;

  record.totalTime = 0;
  for (const pair of record.entryPairs) {
    if (pair.clockIn == null || pair.clockOut == null) {
      pair.missingEntry = true;
      pair.duration = 0;
      pair.dayBoundary = false;
    } else {
      record.totalTime += pair.duration;
    }
  }
  record.formattedTotal = formatDuration(record.totalTime);
}

function cleanupDailyRecords(records: DailyRecord[]): DailyRecord[] {
  // Sort by date (newest first)
  records.sort((a, b) => b.date.localeCompare(a.date));

  for (let i = 1; i < records.length; i++) {
    cleanupMiddleRecord(records[i]);
  }

  if (
    records.length > 0 &&
    records[0].isActive &&
    records[0].entryPairs.length > 0
  ) {
    const lastIndex = records[0].entryPairs.length - 1;
    if (records[0].entryPairs[lastIndex].clockIn != null) {
      records[0].entryPairs[lastIndex].dayBoundary = isSameLocalDay(
        records[0].entryPairs[lastIndex].clockIn,
        records[0].entryPairs[lastIndex].clockOut ?? new Date(),
      );
    }
  }

  return records;
}

/**
 * Processes TimeStampEntry arrays into DailyRecord objects for UI display
 * This groups entries by date and pairs clock-in/clock-out entries
 *
 * @param entries - Array of TimeStampEntry objects from PocketBase
 * @returns Array of DailyRecord objects for UI rendering
 */
function processTimeEntries(entries: TimeStampEntry[]): DailyRecord[] {
  // Group by date (YYYY-MM-DD)
  const entriesByDate: Record<string, TimeStampEntry[]> = {};

  // First pass: group entries by date
  entries.forEach((entry) => {
    const localDate = `${entry.timestamp.getFullYear()}-${String(entry.timestamp.getMonth() + 1).padStart(2, "0")}-${String(entry.timestamp.getDate()).padStart(2, "0")}`;
    if (
      (entriesByDate[localDate] as unknown as TimeStampEntry | undefined) ==
      null
    ) {
      entriesByDate[localDate] = [];
    }
    entriesByDate[localDate].push(entry);
  });

  // Second pass: create DailyRecord objects
  const dailyRecords: DailyRecord[] = [];

  Object.keys(entriesByDate).forEach((date) => {
    const dayEntries = entriesByDate[date];
    // Sort by timestamp (oldest first)
    dayEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const entryPairs: TimeEntryPair[] = [];
    let totalTime = 0;
    let hasMissingEntries = false;
    let isActive = false;

    // Create clock-in/clock-out pairs
    for (let i = 0; i < dayEntries.length; i++) {
      const entry = dayEntries[i];

      if (entry.clock_in) {
        // This is a clock-in, look for next clock-out
        const clockIn = entry.timestamp.getTime();
        let clockOut: number | null = null;
        let duration = 0;
        let dayBoundary = false;
        let missingEntry = false;

        // Look for matching clock-out
        if (i + 1 < dayEntries.length && !dayEntries[i + 1].clock_in) {
          // Found a clock-out
          const clockOutEntry = dayEntries[i + 1];
          clockOut = clockOutEntry.timestamp.getTime();
          duration = clockOut - clockIn;

          // Check for day boundary crossing
          dayBoundary = !isSameLocalDay(new Date(clockIn), new Date(clockOut));

          // Skip the clock-out in next iteration
          i++;
        } else {
          // No matching clock-out, user is still clocked in
          clockOut = null;
          duration = new Date().getTime() - clockIn;
          missingEntry = i !== dayEntries.length - 1;
          isActive = i === dayEntries.length - 1;

          // If it's not the last entry, it's a missing clock-out
          hasMissingEntries ||= missingEntry;
        }

        entryPairs.push({
          clockIn,
          clockOut,
          duration,
          dayBoundary,
          missingEntry,
        });

        // Only add to total time if it's not missing an entry (except for active sessions)
        if (!missingEntry || isActive) {
          totalTime += duration;
        }
      } else {
        // This is a clock-out without a preceding clock-in
        const clockOut = entry.timestamp.getTime();
        // Group with previous day if it's a clock-out without a clock-in
        entryPairs.push({
          clockIn: null,
          clockOut,
          duration: 0, // Unknown duration
          dayBoundary: false,
          missingEntry: true,
        });
        hasMissingEntries = true;
      }
    }

    dailyRecords.push({
      date,
      entryPairs,
      totalTime,
      formattedTotal: formatDuration(totalTime),
      hasMissingEntries,
      isActive,
    });
  });

  return cleanupDailyRecords(dailyRecords);
}

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
  // Store reference to PocketBase entries in local state
  const [timeEntries, setTimeEntries] = createSignal<TimeStampEntry[]>([]);
  const [dailyRecords, setDailyRecords] = createSignal<DailyRecord[]>([]);
  const [currentSessionTime, setCurrentSessionTime] =
    createSignal<string>("00:00:00");
  const [todayTotalTime, setTodayTotalTime] = createSignal<string>("00:00:00");
  const [isLoading, setIsLoading] = createSignal(true);
  const [isClockedIn, setIsClockedIn] = createSignal<boolean>(false);
  const [lastAction, setLastAction] = createSignal<Date | null>(null);

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

  // Process today's record to check if user is clocked in
  const processTimeRecord = (entries: TimeStampEntry[]) => {
    if (entries.length > 0) {
      // Most recent entry first
      const latestEntry = entries.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      )[0];

      setIsClockedIn(latestEntry.clock_in);
      setLastAction(latestEntry.timestamp);
    }
  };

  // Initialize from PocketBase
  onMount(() => {
    setIsLoading(true);

    // Fetch all time records from PocketBase
    Effect.runPromise(getTimeEntries())
      .then((entries) => {
        setTimeEntries(entries);

        // Process records for display
        const processed = processTimeEntries(entries);
        setDailyRecords(processed);

        // Check if user is currently clocked in
        processTimeRecord(entries);

        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error loading time entries from PocketBase:", error);
        setIsLoading(false);
      });
  });

  // Update current session time every second when clocked in
  createEffect(() => {
    if (!isClockedIn() || !lastAction()) return;
    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = now.getTime() - lastAction()!.getTime();
      setCurrentSessionTime(formatDuration(elapsed));
      // Update the work history data in real-time when clocked in
      setDailyRecords(processTimeEntries(timeEntries()));
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
    const isCurrentlyClockedIn = isClockedIn();

    // Call PocketBase to add a new clock entry
    Effect.runPromise(addClockEntry(!isCurrentlyClockedIn, now))
      .then((newEntry) => {
        // Update UI immediately for better user experience
        setIsClockedIn(!isCurrentlyClockedIn);
        setLastAction(now);

        // Update local state by adding the new entry to our entries list
        const updatedEntries = [...timeEntries(), newEntry];
        setTimeEntries(updatedEntries);

        // Process the updated entries to refresh the UI
        setDailyRecords(processTimeEntries(updatedEntries));
      })
      .catch((error) => {
        console.error("Error toggling clock:", error);
      });
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
              <h2 class="card-title">
                <ClockIcon class="mr-2" /> Work Clock Status
              </h2>
              <div class="stats mt-4 shadow">
                <div class="stat">
                  <div class="stat-title">Status</div>
                  <div
                    class={`stat-value ${
                      isClockedIn() ? "text-success" : "text-error"
                    }`}
                  >
                    {isClockedIn() ?
                      <>
                        <ClockPlayIcon class="mr-1 inline-block" /> Clocked In
                      </>
                    : <>
                        <ClockPauseIcon class="mr-1 inline-block" /> Clocked Out
                      </>
                    }
                  </div>
                  <div class="stat-desc">
                    {lastAction() ?
                      <>
                        Last action: {getRelativeTime(lastAction()?.getTime())}
                      </>
                    : "No recent activity"}
                  </div>
                </div>

                <div class="stat">
                  <div class="stat-title">Current Session</div>
                  <div
                    class={`stat-value ${
                      isClockedIn() ? "text-accent" : "text-base-content"
                    }`}
                  >
                    {isClockedIn() ? currentSessionTime() : "-:--:--"}
                  </div>
                  <div class="stat-desc">
                    <div class="badge badge-primary p-3 text-lg">
                      <TimeIcon class="mr-2" /> Today's Total:{" "}
                      {todayTotalTime()}
                    </div>
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

        {/* Legacy Import Section */}
        <Show when={!isLoading()}>
          <LegacyImportPanel />
        </Show>

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
                              {/* Show indicator for days with missing entries */}
                              {record.hasMissingEntries ?
                                <span
                                  class="tooltip tooltip-left ml-2"
                                  data-tip="Contains missing clock-in/out entries"
                                >
                                  <ClockIcon class="text-warning inline-block" />
                                </span>
                              : null}
                              {/* Show indicator for active sessions */}
                              {record.isActive ?
                                <span
                                  class="tooltip tooltip-left ml-2"
                                  data-tip="Currently active session"
                                >
                                  <ClockPlayIcon class="text-success inline-block" />
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
                                              {pair.clockIn != null ?
                                                formatTimeForDisplay(
                                                  pair.clockIn,
                                                )
                                              : "Missing"}
                                            </td>
                                            <td>
                                              {pair.clockOut != null ?
                                                formatClockOutDate(
                                                  pair.clockOut,
                                                  pair.clockIn ?? pair.clockOut,
                                                )
                                              : pair.missingEntry ?
                                                "Missing"
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
                                              {pair.missingEntry ?
                                                "Unknown"
                                              : formatDuration(pair.duration)}
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
      </div>
    </ObserverProvider>
  );
};

export default WorkClock;
