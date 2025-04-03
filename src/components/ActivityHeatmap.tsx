import CalendarIcon from "~icons/tabler/calendar";
import InfoCircleIcon from "~icons/tabler/info-circle";

import { Component, For, createMemo } from "solid-js";

import { DailyRecord } from "./TimeEntryUtils";

interface ActivityHeatmapProps {
  dailyRecords: DailyRecord[];
  onDayClick?: (date: string) => void;
  maxWeeks?: number;
}

/**
 * ActivityHeatmap Component
 *
 * Displays a GitHub-inspired heatmap of work activity by day.
 * Each cell represents a day with color intensity based on work hours.
 */
const ActivityHeatmap: Component<ActivityHeatmapProps> = (props) => {
  const maxWeeks = () => props.maxWeeks ?? 26; // Default to showing half a year

  // Generate array of dates for the last X weeks
  const dates = createMemo(() => {
    const result: string[] = [];
    const today = new Date();
    const startDate = new Date();

    // Go back maxWeeks * 7 days
    startDate.setDate(today.getDate() - maxWeeks() * 7);

    const currentDate = new Date(startDate);

    // Generate all dates between start and today
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split("T")[0];
      result.push(dateStr);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  });

  // Create lookup map for more efficient access to daily records
  const recordsMap = createMemo(() => {
    const map = new Map<string, DailyRecord>();
    props.dailyRecords.forEach((record) => {
      map.set(record.date, record);
    });
    return map;
  });

  // Get all weeks for display
  const weeks = createMemo(() => {
    const allDates = dates();
    const result: string[][] = [];
    let currentWeek: string[] = [];

    // Group dates into weeks
    allDates.forEach((date, index) => {
      const dayOfWeek = new Date(date).getDay();

      // If Sunday or first date, start a new week
      if (dayOfWeek === 0 || index === 0) {
        if (currentWeek.length > 0) {
          result.push(currentWeek);
        }
        currentWeek = [];
      }

      currentWeek.push(date);
    });

    // Add the last week
    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  });

  // Get color intensity for a specific day based on hours worked
  const getColorIntensity = (date: string) => {
    const record = recordsMap().get(date);

    if (!record) {
      return 0; // No work on this day
    }

    // Get total hours worked (totalTime is in milliseconds)
    const hoursWorked = record.totalTime / (1000 * 60 * 60);

    // Determine intensity level (0-4) based on hours
    if (hoursWorked <= 0) return 0;
    if (hoursWorked < 2) return 1;
    if (hoursWorked < 5) return 2;
    if (hoursWorked < 8) return 3;
    return 4; // 8+ hours
  };

  // Format the tooltip for a day
  const getDayTooltip = (date: string) => {
    const record = recordsMap().get(date);
    if (!record) {
      return `Keine Zeiterfassung am ${new Date(date).toLocaleDateString("de-DE")}`;
    }

    const hoursWorked = record.totalTime / (1000 * 60 * 60);
    return `${new Date(date).toLocaleDateString("de-DE")}: ${hoursWorked.toFixed(2)} Stunden`;
  };

  // Handle click on a day cell
  const handleDayClick = (date: string) => {
    if (props.onDayClick && recordsMap().has(date)) {
      props.onDayClick(date);
    }
  };

  // Determine if a date is today
  const isToday = (date: string) => {
    const today = new Date().toISOString().split("T")[0];
    return date === today;
  };

  // Get activity level class for a cell
  const getActivityClass = (date: string) => {
    const level = getColorIntensity(date);

    const baseClass =
      "w-4 h-4 rounded-sm m-0.5 cursor-pointer transition-colors";

    if (level === 0) return `${baseClass} bg-base-300`;
    if (level === 1) return `${baseClass} bg-success bg-opacity-25`;
    if (level === 2) return `${baseClass} bg-success bg-opacity-50`;
    if (level === 3) return `${baseClass} bg-success bg-opacity-75`;
    return `${baseClass} bg-success`;
  };

  return (
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">
          <CalendarIcon class="mr-2" /> Aktivitätsübersicht
        </h2>

        <div class="mt-2 flex items-center text-sm">
          <span class="mr-2">Aktivität:</span>
          <div class="flex items-center gap-1">
            <div class="bg-base-300 h-3 w-3 rounded-sm" />
            <div class="bg-success bg-opacity-25 h-3 w-3 rounded-sm" />
            <div class="bg-success bg-opacity-50 h-3 w-3 rounded-sm" />
            <div class="bg-success bg-opacity-75 h-3 w-3 rounded-sm" />
            <div class="bg-success h-3 w-3 rounded-sm" />
          </div>
          <span class="ml-1">mehr</span>
          <span
            class="tooltip tooltip-top ml-2"
            data-tip="Zeigt die Arbeitszeit pro Tag an. Stärkere Farben bedeuten mehr Arbeitszeit."
          >
            <InfoCircleIcon class="h-4 w-4" />
          </span>
        </div>

        <div class="mt-1 overflow-x-auto">
          <div class="mt-4 flex justify-start">
            <div class="flex flex-col items-end gap-1 pr-2 text-xs opacity-60">
              <div>Mo</div>
              <div>Mi</div>
              <div>Fr</div>
            </div>
            <div class="flex gap-1">
              <For each={weeks()}>
                {(week) => (
                  <div class="flex flex-col">
                    <For each={week}>
                      {(date) => (
                        <div
                          class={`${getActivityClass(date)} ${isToday(date) ? "ring-primary ring-2" : ""}`}
                          onClick={() => handleDayClick(date)}
                          data-tip={getDayTooltip(date)}
                          aria-label={getDayTooltip(date)}
                        />
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        <div class="text-base-content mt-2 text-right text-xs opacity-70">
          Die letzten {maxWeeks()} Wochen
        </div>
      </div>
    </div>
  );
};

export default ActivityHeatmap;
