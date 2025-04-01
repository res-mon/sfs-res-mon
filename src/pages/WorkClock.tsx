import ClockIcon from "~icons/tabler/clock";

import {
  Component,
  JSX,
  Show,
  createEffect,
  createSignal,
  onMount,
} from "solid-js";

import { Effect } from "effect";

import ClockStatusCard from "../components/ClockStatusCard";
import LegacyImportPanel from "../components/LegacyImportPanel";
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
            <ClockIcon class="mr-2 inline-block" /> Work Clock
          </h1>
          <p class="intersect:motion-preset-slide-in-from-right intersect-once mx-auto max-w-3xl text-lg">
            Track your work time efficiently by clocking in and out. View your
            daily time records and total work hours.
          </p>
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

        {/* Legacy Import Section */}
        <Show when={!isLoading()}>
          <LegacyImportPanel />
        </Show>

        {/* Time History Section */}
        <TimeEntryTable dailyRecords={dailyRecords()} />
      </div>
    </ObserverProvider>
  );
};

export default WorkClock;
