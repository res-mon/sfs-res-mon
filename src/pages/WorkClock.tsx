import ClockIcon from "~icons/tabler/clock";

import { Component, JSX, createEffect, createSignal, onMount } from "solid-js";

import { Effect } from "effect";

import ClockStatusCard from "../components/ClockStatusCard";
import TimeEntryTable from "../components/TimeEntryTable";
import {
  DailyRecord,
  formatDuration,
  processTimeEntries,
} from "../components/TimeEntryUtils";
import { TimeStampEntry, getTimeEntries } from "../services/workClock";
import { ObserverProvider } from "./Layout";

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
  const [currentTime, setCurrentTime] = createSignal<[number, number, number]>([
    0, 0, 0,
  ]);

  // Update current time every second
  onMount(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      setCurrentTime([now.getHours(), now.getMinutes(), now.getSeconds()]);
    };

    // Update immediately and then every second
    updateCurrentTime();
    const timeInterval = setInterval(updateCurrentTime, 1000);

    return () => clearInterval(timeInterval);
  });

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
        console.error(
          "Fehler beim Laden der Zeiteinträge aus PocketBase:",
          error,
        );
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

  // Handle clock toggle events from the ClockStatusCard component
  const handleClockToggle = (newEntry: TimeStampEntry) => {
    // Update UI immediately for better user experience
    setIsClockedIn(!isClockedIn());
    setLastAction(newEntry.timestamp);

    // Update local state by adding the new entry to our entries list
    const updatedEntries = [...timeEntries(), newEntry];
    setTimeEntries(updatedEntries);

    // Process the updated entries to refresh the UI
    setDailyRecords(processTimeEntries(updatedEntries));
  };

  return (
    <ObserverProvider>
      <div class="space-y-8">
        {/* Header Section */}
        <div class="text-center">
          <h1 class="intersect:motion-preset-slide-in-from-left intersect-once mb-4 text-4xl font-bold">
            <ClockIcon class="mr-2 inline-block" /> Stempeluhr
          </h1>
          <p class="intersect:motion-preset-slide-in-from-right intersect-once mx-auto max-w-3xl text-lg">
            Verfolge deine Arbeitszeit effizient durch Ein- und Ausstempeln.
            Sieh dir deine täglichen Zeitaufzeichnungen und die gesamte
            Arbeitszeit an.
          </p>
        </div>

        {/* Current Time Display with DaisyUI Countdown */}
        <div class="intersect:motion-preset-fade-in intersect-once mx-auto w-full">
          <div class="flex flex-col items-center justify-center">
            <span class="countdown font-mono text-5xl sm:text-7xl lg:text-9xl">
              <span
                aria-live="polite"
                aria-label={`${currentTime()[0]}`}
                {...{ style: { "--value": currentTime()[0] } }}
              >
                {currentTime()[0]}
              </span>
              :
              <span
                aria-live="polite"
                aria-label={`${currentTime()[1]}`}
                {...{ style: { "--value": currentTime()[1] } }}
              >
                {currentTime()[1]}
              </span>
              :
              <span
                aria-live="polite"
                aria-label={`${currentTime()[2]}`}
                {...{ style: { "--value": currentTime()[2] } }}
              >
                {currentTime()[2]}
              </span>
            </span>
          </div>
        </div>

        {/* Clock In/Out Section */}
        <ClockStatusCard
          isLoading={isLoading()}
          isClockedIn={isClockedIn()}
          lastAction={lastAction()}
          currentSessionTime={currentSessionTime()}
          todayTotalTime={todayTotalTime()}
          onClockToggle={handleClockToggle}
        />

        {/* Time History Section */}
        <TimeEntryTable dailyRecords={dailyRecords()} />
      </div>
    </ObserverProvider>
  );
};

export default WorkClock;
