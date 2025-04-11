import AlertCircleIcon from "~icons/tabler/alert-circle";
import ArrowsLeftRightIcon from "~icons/tabler/arrows-left-right";
import EnergyIcon from "~icons/tabler/bulb";
import CalendarIcon from "~icons/tabler/calendar";
import ChartBarIcon from "~icons/tabler/chart-bar";
import ChartIcon from "~icons/tabler/chart-line";
import ClockIcon from "~icons/tabler/clock";
import MapIcon from "~icons/tabler/map";
import ReportIcon from "~icons/tabler/report-analytics";
import TableIcon from "~icons/tabler/table";
import TimelineIcon from "~icons/tabler/timeline";

import {
  Component,
  For,
  JSX,
  Show,
  createEffect,
  createSignal,
  onMount,
} from "solid-js";

import ActivityHeatmap from "../components/ActivityHeatmap";
import CircularTimeDisplay from "../components/CircularTimeDisplay";
import ClockInOutPairForm from "../components/ClockInOutPairForm";
import ClockStatusCard from "../components/ClockStatusCard";
import ComparisonView from "../components/ComparisonView";
import EnergyChart from "../components/EnergyChart";
import MonthCalendar from "../components/MonthCalendar";
import StatsDashboard from "../components/StatsDashboard";
import TimeEntryTable from "../components/TimeEntryTable";
import {
  DailyRecord,
  formatDuration,
  processTimeEntries,
} from "../components/TimeEntryUtils";
import TimelineView from "../components/TimelineView";
import WeekPattern from "../components/WeekPattern";
import WorkJourney from "../components/WorkJourney";
import { TimeStampEntry, getTimeEntriesStream } from "../services/workClock";
import { ObserverProvider } from "./Layout";

/**
 * WorkClock Component
 *
 * Main page component for the time tracking functionality.
 * This component:
 * 1. Manages the work clock state and UI interactions
 * 2. Displays various visualizations of time data
 * 3. Allows users to clock in and out
 * 4. Provides multiple data visualization options through tabs
 *
 * @returns {JSX.Element} The rendered component
 */
const WorkClock: Component = (): JSX.Element => {
  // Store reference to PocketBase entries in local state
  const [dailyRecords, setDailyRecords] = createSignal<DailyRecord[]>([]);
  const [currentSessionTime, setCurrentSessionTime] =
    createSignal<string>("00:00:00");
  const [todayTotalTime, setTodayTotalTime] = createSignal<string>("00:00:00");
  const [isClockedIn, setIsClockedIn] = createSignal<boolean>(false);
  const [lastAction, setLastAction] = createSignal<Date | null>(null);
  const [currentTime, setCurrentTime] = createSignal<[number, number, number]>([
    0, 0, 0,
  ]);

  // Get reactive time entries stream with real-time updates
  const { loading, entries, error } = getTimeEntriesStream();

  /**
   * VisualType - Union type for the different visualization modes
   * Controls which visualization component is rendered in the UI
   */
  type VisualType =
    | "heatmap"
    | "clock"
    | "timeline"
    | "stats"
    | "comparison"
    | "table"
    | "weekpattern"
    | "journey"
    | "energy"
    | "calendar"
    | "pairform";
  const [activeVisual, setActiveVisual] = createSignal<VisualType>("heatmap");
  const [selectedDate, setSelectedDate] = createSignal<string | undefined>(
    undefined,
  );

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

  /**
   * Process time entries to determine if the user is currently clocked in
   *
   * @param {TimeStampEntry[]} entries - The list of time entries to process sorted by oldest first.
   */
  const processTimeRecord = (entries: TimeStampEntry[]) => {
    if (entries.length > 0) {
      // Most recent entry first
      const latestEntry = entries[entries.length - 1];

      setIsClockedIn(latestEntry.clock_in);
      setLastAction(latestEntry.timestamp);
    }
  };

  createEffect(() => {
    const processed = processTimeEntries(entries());
    setDailyRecords(processed);

    // Check if user is currently clocked in
    processTimeRecord(entries());
  });

  // Update current session time every second when clocked in
  createEffect(() => {
    if (!isClockedIn() || !lastAction()) return;
    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = now.getTime() - lastAction()!.getTime();
      setCurrentSessionTime(formatDuration(elapsed));
      // Update the work history data in real-time when clocked in
      setDailyRecords(processTimeEntries(entries()));
    }, 1000);
    return () => clearInterval(interval);
  });

  /**
   * Calculate the total time worked today
   * Finds today's record in dailyRecords and updates the today total time signal
   */
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

  /**
   * Handle day selection from various visualizations
   * When a day is clicked in heatmap, journey view or calendar, this shows the daily detail view
   *
   * @param {string} date - The selected date in ISO format (YYYY-MM-DD)
   */
  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    setActiveVisual("clock");
  };

  // Group visualizations for tab organization
  const visualizations = [
    {
      id: "heatmap",
      label: "Aktivitätsübersicht",
      icon: <ChartIcon class="mr-1 hidden sm:inline" />,
    },
    {
      id: "clock",
      label: "Tagesverlauf",
      icon: <ClockIcon class="mr-1 hidden sm:inline" />,
    },
    {
      id: "timeline",
      label: "Zeitverlauf",
      icon: <TimelineIcon class="mr-1 hidden sm:inline" />,
    },
    {
      id: "calendar",
      label: "Monatsübersicht",
      icon: <CalendarIcon class="mr-1 hidden sm:inline" />,
    },
    {
      id: "energy",
      label: "Energiekurve",
      icon: <EnergyIcon class="mr-1 hidden sm:inline" />,
    },
    {
      id: "weekpattern",
      label: "Wochenmuster",
      icon: <ReportIcon class="mr-1 hidden sm:inline" />,
    },
    {
      id: "journey",
      label: "Arbeitsreise",
      icon: <MapIcon class="mr-1 hidden sm:inline" />,
    },
    {
      id: "stats",
      label: "Statistik",
      icon: <ChartBarIcon class="mr-1 hidden sm:inline" />,
    },
    {
      id: "comparison",
      label: "Vergleich",
      icon: <ArrowsLeftRightIcon class="mr-1 hidden sm:inline" />,
    },
    {
      id: "table",
      label: "Tabelle",
      icon: <TableIcon class="mr-1 hidden sm:inline" />,
    },
    {
      id: "pairform",
      label: "Zeitpaar hinzufügen",
      icon: <ClockIcon class="mr-1 hidden sm:inline" />,
    },
  ];

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

        {/* Error Alert */}
        <Show when={error() !== undefined}>
          <div class="alert alert-error mx-auto max-w-4xl shadow-lg">
            <AlertCircleIcon class="h-6 w-6" />
            <div>
              <h3 class="font-bold">Fehler beim Laden der Zeiteinträge</h3>
              <div class="text-sm">
                {error()?.message ?? "Unbekannter Fehler"}
              </div>
              <div class="text-xs opacity-70">Typ: {error()?.type}</div>
            </div>
          </div>
        </Show>

        {/* Current Time Display with DaisyUI Countdown */}
        <div class="intersect:motion-preset-fade-in intersect-once mx-auto w-full">
          <div class="flex flex-col items-center justify-center">
            <span class="countdown font-mono text-5xl sm:text-7xl lg:text-9xl">
              <span
                aria-live="polite"
                aria-label={`${currentTime()[0]}`}
                style={{ "--value": currentTime()[0] }}
              >
                {currentTime()[0]}
              </span>
              :
              <span
                aria-live="polite"
                aria-label={`${currentTime()[1]}`}
                style={{ "--value": currentTime()[1] }}
              >
                {currentTime()[1]}
              </span>
              :
              <span
                aria-live="polite"
                aria-label={`${currentTime()[2]}`}
                style={{ "--value": currentTime()[2] }}
              >
                {currentTime()[2]}
              </span>
            </span>
          </div>
        </div>

        {/* Clock In/Out Section */}
        <ClockStatusCard
          isLoading={loading()}
          isClockedIn={isClockedIn()}
          lastAction={lastAction()}
          currentSessionTime={currentSessionTime()}
          todayTotalTime={todayTotalTime()}
        />

        {/* Visualization toggle buttons in a scrollable container */}
        <div class="flex justify-center">
          <div class="tabs tabs-boxed bg-base-200 max-w-full overflow-x-auto p-1">
            <For each={visualizations}>
              {(vis) => (
                <button
                  class={`tab tab-sm sm:tab-md whitespace-nowrap ${activeVisual() === vis.id ? "tab-active" : ""}`}
                  onClick={() => setActiveVisual(vis.id as VisualType)}
                >
                  {vis.icon}
                  {vis.label}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Visualizations */}
        <Show when={!loading()}>
          <Show when={activeVisual() === "heatmap"}>
            <div class="intersect:motion-preset-fade-in intersect-once">
              <ActivityHeatmap
                dailyRecords={dailyRecords()}
                onDayClick={handleDayClick}
              />
            </div>
          </Show>

          <Show when={activeVisual() === "clock"}>
            <div class="intersect:motion-preset-fade-in intersect-once">
              <CircularTimeDisplay
                dailyRecords={dailyRecords()}
                selectedDate={selectedDate()}
                onDateSelect={setSelectedDate}
              />
            </div>
          </Show>

          <Show when={activeVisual() === "timeline"}>
            <div class="intersect:motion-preset-fade-in intersect-once">
              <TimelineView dailyRecords={dailyRecords()} />
            </div>
          </Show>

          <Show when={activeVisual() === "calendar"}>
            <div class="intersect:motion-preset-fade-in intersect-once">
              <MonthCalendar
                dailyRecords={dailyRecords()}
                onDateSelect={handleDayClick}
              />
            </div>
          </Show>

          <Show when={activeVisual() === "energy"}>
            <div class="intersect:motion-preset-fade-in intersect-once">
              <EnergyChart
                dailyRecords={dailyRecords()}
                daysToAnalyze={30}
              />
            </div>
          </Show>

          <Show when={activeVisual() === "weekpattern"}>
            <div class="intersect:motion-preset-fade-in intersect-once">
              <WeekPattern dailyRecords={dailyRecords()} />
            </div>
          </Show>

          <Show when={activeVisual() === "journey"}>
            <div class="intersect:motion-preset-fade-in intersect-once">
              <WorkJourney
                dailyRecords={dailyRecords()}
                onDaySelect={handleDayClick}
              />
            </div>
          </Show>

          <Show when={activeVisual() === "stats"}>
            <div class="intersect:motion-preset-fade-in intersect-once">
              <StatsDashboard dailyRecords={dailyRecords()} />
            </div>
          </Show>

          <Show when={activeVisual() === "comparison"}>
            <div class="intersect:motion-preset-fade-in intersect-once">
              <ComparisonView dailyRecords={dailyRecords()} />
            </div>
          </Show>

          <Show when={activeVisual() === "table"}>
            <div class="intersect:motion-preset-fade-in intersect-once">
              <TimeEntryTable dailyRecords={dailyRecords()} />
            </div>
          </Show>

          <Show when={activeVisual() === "pairform"}>
            <div class="intersect:motion-preset-fade-in intersect-once">
              <ClockInOutPairForm />
            </div>
          </Show>
        </Show>
      </div>
    </ObserverProvider>
  );
};

export default WorkClock;
