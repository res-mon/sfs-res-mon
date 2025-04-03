import BulbIcon from "~icons/tabler/bulb";
import ClockIcon from "~icons/tabler/clock";
import InfoCircleIcon from "~icons/tabler/info-circle";
import RocketIcon from "~icons/tabler/rocket";

import { Component, For, Show, createMemo } from "solid-js";

import { format, isWithinInterval, parseISO, subDays } from "date-fns";

import { DailyRecord } from "./TimeEntryUtils";

interface EnergyChartProps {
  dailyRecords: DailyRecord[];
  daysToAnalyze?: number;
}

/**
 * EnergyChart Component
 *
 * Analyzes recent working patterns to identify and visualize the user's
 * most productive hours of the day based on when they typically work.
 */
const EnergyChart: Component<EnergyChartProps> = (props) => {
  const daysToAnalyze = () => props.daysToAnalyze ?? 30;

  // Initialize the hour distribution map with zeros
  const initializeHourDistribution = () => {
    const distribution: Record<number, number> = {};
    for (let hour = 0; hour < 24; hour++) {
      distribution[hour] = 0;
    }
    return distribution;
  };

  // Extract work sessions from daily records
  const getWorkSessions = (dailyRecords: DailyRecord[], cutoffDate: Date) => {
    const sessions: { start: Date; end: Date }[] = [];

    for (const record of dailyRecords) {
      const recordDate = parseISO(record.date);

      // Only analyze recent data
      if (recordDate < cutoffDate) continue;

      // Extract sessions from entries
      for (const entry of record.entryPairs) {
        if (entry.clockIn != null && entry.clockOut != null) {
          sessions.push({
            start: new Date(entry.clockIn),
            end: new Date(entry.clockOut),
          });
        }
      }
    }

    return sessions;
  };

  // Normalize time to reference day
  const normalizeTime = (date: Date) => {
    return new Date(
      2020,
      0,
      1,
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
    );
  };

  // Calculate session overlap with an hour window
  const calculateHourOverlap = (
    session: { start: Date; end: Date },
    hourWindow: { start: Date; end: Date },
    hour: number,
    hourDistribution: Record<number, number>,
  ) => {
    const normalizedStart = normalizeTime(session.start);
    const normalizedEnd = normalizeTime(session.end);

    // Handle overnight sessions
    if (normalizedEnd < normalizedStart) {
      normalizedEnd.setDate(normalizedEnd.getDate() + 1);
    }

    let minutesWorked = 0;

    // Check if this hour is completely within the session
    if (
      normalizedStart <= hourWindow.start &&
      normalizedEnd >= hourWindow.end
    ) {
      hourDistribution[hour] += 1;
      minutesWorked += 60;
    }
    // Check if the session starts within this hour
    else if (
      isWithinInterval(normalizedStart, hourWindow) &&
      normalizedEnd >= hourWindow.end
    ) {
      hourDistribution[hour] += 0.5;
      minutesWorked += 60 - normalizedStart.getMinutes();
    }
    // Check if the session ends within this hour
    else if (
      isWithinInterval(normalizedEnd, hourWindow) &&
      normalizedStart <= hourWindow.start
    ) {
      hourDistribution[hour] += 0.5;
      minutesWorked += normalizedEnd.getMinutes();
    }
    // Check if the session is completely within this hour
    else if (
      isWithinInterval(normalizedStart, hourWindow) &&
      isWithinInterval(normalizedEnd, hourWindow)
    ) {
      const sessionMinutes =
        (normalizedEnd.getTime() - normalizedStart.getTime()) / (1000 * 60);
      hourDistribution[hour] += sessionMinutes / 60;
      minutesWorked += sessionMinutes;
    }

    return minutesWorked;
  };

  // Analyze working patterns from time entries
  const hourlyDistribution = createMemo(() => {
    // Start with a zero-filled distribution
    const hourDistribution = initializeHourDistribution();
    const hourTotalMinutes: Record<number, number> = { ...hourDistribution };
    const now = new Date();
    const cutoffDate = subDays(now, daysToAnalyze());

    // Get work sessions
    const sessions = getWorkSessions(props.dailyRecords, cutoffDate);

    // Analyze each hour of the day
    for (let hour = 0; hour < 24; hour++) {
      // Create a 1-hour window to check against
      const hourWindow = {
        start: new Date(2020, 0, 1, hour, 0, 0),
        end: new Date(2020, 0, 1, hour, 59, 59),
      };

      let minutesWorked = 0;

      // Analyze each session
      for (const session of sessions) {
        minutesWorked += calculateHourOverlap(
          session,
          hourWindow,
          hour,
          hourDistribution,
        );
      }

      // Store the total minutes worked in this hour
      hourTotalMinutes[hour] = minutesWorked;
    }

    // Return both the frequency and minutes data
    return { hourDistribution, hourTotalMinutes };
  });

  // Format the hour for display
  const formatHour = (hour: number) => {
    return format(new Date(2020, 0, 1, hour), "HH:mm");
  };

  // Calculate optimal focus periods
  const focusPeriods = createMemo(() => {
    const { hourDistribution } = hourlyDistribution();
    const periods: { start: number; end: number; intensity: number }[] = [];
    let currentPeriod: {
      start: number;
      end: number;
      intensity: number;
    } | null = null;

    // Find contiguous blocks of productive time
    for (let hour = 0; hour < 24; hour++) {
      const intensity = hourDistribution[hour];

      // If this hour has significant work frequency
      if (intensity > 0.4) {
        if (!currentPeriod) {
          // Start a new period
          currentPeriod = { start: hour, end: hour, intensity };
        } else {
          // Extend the current period
          currentPeriod.end = hour;
          // Use the average intensity
          currentPeriod.intensity =
            (currentPeriod.intensity *
              (currentPeriod.end - currentPeriod.start) +
              intensity) /
            (currentPeriod.end - currentPeriod.start + 1);
        }
      } else if (currentPeriod) {
        // End the current period if intensity drops
        periods.push({ ...currentPeriod });
        currentPeriod = null;
      }
    }

    // Add the last period if it exists
    if (currentPeriod) {
      periods.push(currentPeriod);
    }

    // Only keep periods that are at least 1 hour long
    return (
      periods
        .filter((p) => p.end - p.start >= 1)
        // Sort by intensity (highest first)
        .sort((a, b) => b.intensity - a.intensity)
    );
  });

  // Get the maximum value for scaling
  const maxIntensity = createMemo(() => {
    const { hourDistribution } = hourlyDistribution();
    return Math.max(...Object.values(hourDistribution));
  });

  // Get the bar height as a percentage of the maximum
  const getBarHeight = (intensity: number) => {
    const max = maxIntensity();
    if (max === 0) return "0%";
    return `${(intensity / max) * 100}%`;
  };

  // Get the color class based on intensity
  const getIntensityColorClass = (intensity: number) => {
    const max = maxIntensity();
    if (max === 0) return "bg-base-300";

    const percentage = (intensity / max) * 100;

    if (percentage >= 80) return "bg-accent";
    if (percentage >= 60) return "bg-primary";
    if (percentage >= 40) return "bg-primary bg-opacity-80";
    if (percentage >= 20) return "bg-primary bg-opacity-60";
    return "bg-primary bg-opacity-40";
  };

  // Format a period for display
  const formatPeriod = (start: number, end: number) => {
    return `${formatHour(start)} - ${formatHour(end + 1)}`;
  };

  return (
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">
          <BulbIcon class="mr-2" /> Energie & Fokus Kurve
        </h2>

        <p class="text-sm opacity-75">
          <InfoCircleIcon class="mr-1 inline" />
          Basierend auf deinen Arbeitssessions der letzten {daysToAnalyze()}{" "}
          Tage. Zeigt dir, zu welchen Tageszeiten du typischerweise am aktivsten
          bist.
        </p>

        <div class="mt-4">
          <div class="flex h-48 items-end gap-1">
            <For each={Object.entries(hourlyDistribution().hourDistribution)}>
              {([hour, intensity]) => (
                <div class="flex flex-1 flex-col items-center">
                  <div
                    class="tooltip tooltip-bottom"
                    data-tip={`${(intensity * 100).toFixed(0)}% Aktivität`}
                  >
                    <div
                      class={`w-full ${getIntensityColorClass(intensity)} rounded-t-sm transition-all duration-300`}
                      style={{ height: getBarHeight(intensity) }}
                    />
                  </div>
                  <div class="mt-1 text-xs opacity-70">
                    {Number(hour) % 3 === 0 ? formatHour(Number(hour)) : ""}
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        <div class="divider" />

        <h3 class="flex items-center font-bold">
          <RocketIcon class="mr-2" /> Optimale Fokuszeiten
        </h3>

        <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <Show when={focusPeriods().length > 0}>
            <For each={focusPeriods().slice(0, 4)}>
              {(period, index) => (
                <div
                  class={`flex items-center rounded-lg p-2 ${index() === 0 ? "bg-accent text-accent-content" : "bg-base-300"}`}
                >
                  <ClockIcon class="mr-2" />
                  <div class="flex-1">
                    <div class="font-bold">
                      {formatPeriod(period.start, period.end)}
                    </div>
                    <div class="text-xs opacity-80">
                      {index() === 0 ?
                        "Höchste Produktivität"
                      : "Gute Fokuszeit"}
                    </div>
                  </div>
                  <div class="badge">
                    {(period.intensity * 100).toFixed(0)}%
                  </div>
                </div>
              )}
            </For>
          </Show>

          <Show when={focusPeriods().length === 0}>
            <div class="alert">
              <InfoCircleIcon />
              <span>
                Nicht genügend Daten für eine zuverlässige Analyse. Sammle mehr
                Arbeitsdaten.
              </span>
            </div>
          </Show>
        </div>

        <div class="bg-base-300 mt-4 rounded-lg p-3 text-sm">
          <h4 class="mb-1 font-bold">Wie nutze ich diese Information?</h4>
          <ul class="list-inside list-disc space-y-1 opacity-80">
            <li>
              Plane anspruchsvolle Aufgaben während deiner Hochleistungszeiten
            </li>
            <li>Nutze Energietäler für administrative oder leichte Aufgaben</li>
            <li>Vergleiche deine Kurve mit deinen Arbeitsstundenplänen</li>
            <li>Experimentiere mit verschiedenen Arbeitsrhythmen</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EnergyChart;
